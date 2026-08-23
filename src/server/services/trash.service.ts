import { Role, type Folder } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { nextAvailableName } from "@/server/domain/naming";
import { buildChildPath, toLikePrefix } from "@/server/domain/paths";
import { badRequest, notFound } from "@/server/errors";
import { requireUser, type RequestContext } from "@/server/http/context";
import {
  assertCanWrite,
  requireDataRoomOwner,
  resolveFileAccess,
  resolveFolderAccess,
} from "@/server/services/access.service";
import { takenFileNames, toFileDto } from "@/server/services/file.service";
import {
  removeSubtreeObjects,
  takenChildFolderNames,
  toFolderDto,
} from "@/server/services/folder.service";
import { getStorage } from "@/server/storage";
import type { ExplorerItemDto, TrashedExplorerItemDto, TrashedItemDto } from "@/types/dto";

export const TRASH_RETENTION_DAYS = 30;
const MS_PER_DAY = 86_400_000;

function daysRemaining(deletedAt: Date, now = new Date()): number {
  const expiresAt = deletedAt.getTime() + TRASH_RETENTION_DAYS * MS_PER_DAY;
  return Math.max(0, Math.ceil((expiresAt - now.getTime()) / MS_PER_DAY));
}

async function writableDataRoomIds(userId: string, email: string): Promise<string[]> {
  const [owned, grants] = await Promise.all([
    prisma.dataRoom.findMany({
      where: { ownerId: userId, deletedAt: null },
      select: { id: true },
    }),
    prisma.shareGrant.findMany({
      where: {
        email,
        revokedAt: null,
        role: { in: [Role.EDITOR, Role.OWNER] },
        share: {
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          dataRoom: { deletedAt: null },
        },
      },
      select: { share: { select: { dataRoomId: true } } },
    }),
  ]);

  return [
    ...new Set([
      ...owned.map((room) => room.id),
      ...grants.map((grant) => grant.share.dataRoomId),
    ]),
  ];
}

function toTrashItem(input: {
  item: TrashedExplorerItemDto;
  deletedAt: Date;
  dataRoomId: string;
  dataRoomName: string;
}): TrashedItemDto {
  return {
    item: input.item,
    deletedAt: input.deletedAt.toISOString(),
    daysRemaining: daysRemaining(input.deletedAt),
    dataRoomId: input.dataRoomId,
    dataRoomName: input.dataRoomName,
  };
}

async function destroyFolder(folder: Folder): Promise<void> {
  await removeSubtreeObjects(folder);
  await prisma.folder.delete({ where: { id: folder.id } });
}

async function destroyFile(fileId: string): Promise<void> {
  const versions = await prisma.fileVersion.findMany({
    where: { fileId },
    select: { storageKey: true },
  });
  await prisma.file.delete({ where: { id: fileId } });
  await getStorage().remove(versions.map((version) => version.storageKey));
}

async function destroyDataRoom(dataRoomId: string): Promise<void> {
  const root = await prisma.folder.findFirst({
    where: { dataRoomId, parentId: null },
  });
  if (root) await removeSubtreeObjects(root);
  await prisma.dataRoom.delete({ where: { id: dataRoomId } });
}

export async function purgeExpiredTrash(): Promise<void> {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_DAYS * MS_PER_DAY);

  const expiredRooms = await prisma.dataRoom.findMany({
    where: { deletedAt: { lte: cutoff } },
    select: { id: true },
  });
  for (const room of expiredRooms) {
    await destroyDataRoom(room.id);
  }

  const expiredFolders = await prisma.folder.findMany({
    where: {
      deletedAt: { lte: cutoff },
      parentId: { not: null },
      parent: { deletedAt: null },
      dataRoom: { deletedAt: null },
    },
  });

  for (const folder of expiredFolders) {
    await destroyFolder(folder);
  }

  const expiredFiles = await prisma.file.findMany({
    where: {
      deletedAt: { lte: cutoff },
      folder: { deletedAt: null },
      dataRoom: { deletedAt: null },
    },
    select: { id: true },
  });

  for (const file of expiredFiles) {
    await destroyFile(file.id);
  }
}

export async function listTrash(context: RequestContext): Promise<TrashedItemDto[]> {
  const user = requireUser(context);
  await purgeExpiredTrash();

  const roomIds = await writableDataRoomIds(user.id, user.email);

  const [folders, files, rooms, trashedRooms] = await Promise.all([
    roomIds.length === 0
      ? Promise.resolve([])
      : prisma.folder.findMany({
          where: {
            dataRoomId: { in: roomIds },
            deletedAt: { not: null },
            parentId: { not: null },
            parent: { deletedAt: null },
            dataRoom: { deletedAt: null },
          },
          orderBy: { deletedAt: "desc" },
        }),
    roomIds.length === 0
      ? Promise.resolve([])
      : prisma.file.findMany({
          where: {
            dataRoomId: { in: roomIds },
            deletedAt: { not: null },
            folder: { deletedAt: null },
            dataRoom: { deletedAt: null },
          },
          orderBy: { deletedAt: "desc" },
        }),
    roomIds.length === 0
      ? Promise.resolve([])
      : prisma.dataRoom.findMany({
          where: { id: { in: roomIds } },
          select: { id: true, name: true },
        }),
    prisma.dataRoom.findMany({
      where: { ownerId: user.id, deletedAt: { not: null } },
      orderBy: { deletedAt: "desc" },
    }),
  ]);

  const roomNameById = new Map(rooms.map((room) => [room.id, room.name]));

  const items: TrashedItemDto[] = [
    ...trashedRooms.flatMap((room) =>
      room.deletedAt
        ? [
            toTrashItem({
              item: {
                kind: "dataRoom",
                id: room.id,
                name: room.name,
                description: room.description,
              },
              deletedAt: room.deletedAt,
              dataRoomId: room.id,
              dataRoomName: room.name,
            }),
          ]
        : [],
    ),
    ...folders.flatMap((folder) =>
      folder.deletedAt
        ? [
            toTrashItem({
              item: toFolderDto(folder),
              deletedAt: folder.deletedAt,
              dataRoomId: folder.dataRoomId,
              dataRoomName: roomNameById.get(folder.dataRoomId) ?? "",
            }),
          ]
        : [],
    ),
    ...files.flatMap((file) =>
      file.deletedAt
        ? [
            toTrashItem({
              item: toFileDto(file),
              deletedAt: file.deletedAt,
              dataRoomId: file.dataRoomId,
              dataRoomName: roomNameById.get(file.dataRoomId) ?? "",
            }),
          ]
        : [],
    ),
  ];

  items.sort((left, right) => right.deletedAt.localeCompare(left.deletedAt));
  return items;
}

export async function restoreTrashItem(
  context: RequestContext,
  input: { kind: "file" | "folder" | "dataRoom"; id: string },
): Promise<TrashedExplorerItemDto> {
  if (input.kind === "dataRoom") return restoreDataRoom(context, input.id);
  return input.kind === "folder"
    ? restoreFolder(context, input.id)
    : restoreFile(context, input.id);
}

async function restoreFolder(context: RequestContext, folderId: string): Promise<ExplorerItemDto> {
  const { folder, access } = await resolveFolderAccess(context, folderId, {
    includeDeleted: true,
  });
  assertCanWrite(access);
  if (!folder.deletedAt) throw badRequest("This folder is not in the trash.");

  let parent = folder.parentId
    ? await prisma.folder.findUnique({ where: { id: folder.parentId } })
    : null;

  if (!parent || parent.deletedAt) {
    parent = await prisma.folder.findFirst({
      where: { dataRoomId: folder.dataRoomId, parentId: null },
    });
  }
  if (!parent) throw notFound("This data room no longer exists.");

  const name = nextAvailableName(folder.name, await takenChildFolderNames(parent.id));
  const oldPath = folder.path;
  const newPath = buildChildPath(parent.path, folder.id);
  const depthDelta = parent.depth + 1 - folder.depth;
  const pathStart = oldPath.length + 1;
  const parentId = parent.id;

  await prisma.$transaction(async (tx) => {
    await tx.folder.update({
      where: { id: folder.id },
      data: {
        parentId,
        name,
        path: newPath,
        depth: folder.depth + depthDelta,
        deletedAt: null,
        deletedById: null,
      },
    });

    if (newPath !== oldPath) {
      await tx.$executeRaw`
        UPDATE "Folder"
        SET
          "path" = ${newPath} || substring("path" from ${pathStart}),
          "depth" = "depth" + ${depthDelta},
          "updatedAt" = NOW()
        WHERE "dataRoomId" = ${folder.dataRoomId}
          AND "id" <> ${folder.id}
          AND "path" LIKE ${toLikePrefix(oldPath)}
      `;
    }

    await tx.folder.updateMany({
      where: {
        dataRoomId: folder.dataRoomId,
        path: { startsWith: newPath },
        deletedAt: { not: null },
      },
      data: { deletedAt: null, deletedById: null },
    });
    await tx.file.updateMany({
      where: {
        dataRoomId: folder.dataRoomId,
        deletedAt: { not: null },
        folder: { path: { startsWith: newPath } },
      },
      data: { deletedAt: null, deletedById: null },
    });
  });

  const restored = await prisma.folder.findUniqueOrThrow({ where: { id: folder.id } });
  return toFolderDto(restored);
}

async function restoreFile(context: RequestContext, fileId: string): Promise<ExplorerItemDto> {
  const { file, access } = await resolveFileAccess(context, fileId, { includeDeleted: true });
  assertCanWrite(access);
  if (!file.deletedAt) throw badRequest("This file is not in the trash.");

  let folder = await prisma.folder.findUnique({ where: { id: file.folderId } });
  if (!folder || folder.deletedAt) {
    folder = await prisma.folder.findFirst({
      where: { dataRoomId: file.dataRoomId, parentId: null },
    });
  }
  if (!folder) throw notFound("This data room no longer exists.");

  const name = nextAvailableName(file.name, await takenFileNames(folder.id));
  const restored = await prisma.file.update({
    where: { id: file.id },
    data: {
      folderId: folder.id,
      name,
      deletedAt: null,
      deletedById: null,
    },
  });
  return toFileDto(restored);
}

async function restoreDataRoom(
  context: RequestContext,
  dataRoomId: string,
): Promise<TrashedExplorerItemDto> {
  await requireDataRoomOwner(context, dataRoomId, { includeDeleted: true });
  const room = await prisma.dataRoom.findUnique({ where: { id: dataRoomId } });
  if (!room) throw notFound("This data room no longer exists.");
  if (!room.deletedAt) throw badRequest("This data room is not in the trash.");

  const restored = await prisma.dataRoom.update({
    where: { id: dataRoomId },
    data: { deletedAt: null, deletedById: null },
  });

  return {
    kind: "dataRoom",
    id: restored.id,
    name: restored.name,
    description: restored.description,
  };
}

export async function permanentlyDeleteTrashItem(
  context: RequestContext,
  input: { kind: "file" | "folder" | "dataRoom"; id: string },
): Promise<void> {
  if (input.kind === "dataRoom") {
    await requireDataRoomOwner(context, input.id, { includeDeleted: true });
    const room = await prisma.dataRoom.findUnique({ where: { id: input.id } });
    if (!room) throw notFound("This data room no longer exists.");
    if (!room.deletedAt) throw badRequest("This data room is not in the trash.");
    await destroyDataRoom(room.id);
    return;
  }

  if (input.kind === "folder") {
    const { folder, access } = await resolveFolderAccess(context, input.id, {
      includeDeleted: true,
    });
    assertCanWrite(access);
    if (!folder.deletedAt) throw badRequest("This folder is not in the trash.");
    if (folder.parentId === null) {
      throw badRequest("The root folder cannot be deleted.");
    }
    await destroyFolder(folder);
    return;
  }

  const { file, access } = await resolveFileAccess(context, input.id, { includeDeleted: true });
  assertCanWrite(access);
  if (!file.deletedAt) throw badRequest("This file is not in the trash.");
  await destroyFile(file.id);
}

export async function emptyTrash(context: RequestContext): Promise<void> {
  const items = await listTrash(context);
  for (const entry of items) {
    await permanentlyDeleteTrashItem(context, {
      kind: entry.item.kind,
      id: entry.item.id,
    });
  }
}
