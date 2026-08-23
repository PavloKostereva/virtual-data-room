import { prisma } from "@/server/db/prisma";
import { newId } from "@/server/domain/id";
import { badRequest, notFound } from "@/server/errors";
import type { RequestContext } from "@/server/http/context";
import { requireUser } from "@/server/http/context";
import {
  resolveFileAccess,
  resolveFolderAccess,
} from "@/server/services/access.service";
import type { ExplorerItemDto, StarredItemDto } from "@/types/dto";

export type StarSubject = { type: "FILE"; id: string } | { type: "FOLDER"; id: string };

export async function getStarredSubjectIds(
  userId: string,
  subjects: StarSubject[],
): Promise<Set<string>> {
  if (subjects.length === 0) return new Set();

  const fileIds = subjects.filter((s) => s.type === "FILE").map((s) => s.id);
  const folderIds = subjects.filter((s) => s.type === "FOLDER").map((s) => s.id);

  try {
    const stars = await prisma.star?.findMany({
      where: {
        userId,
        OR: [
          ...(fileIds.length > 0 ? [{ fileId: { in: fileIds } }] : []),
          ...(folderIds.length > 0 ? [{ folderId: { in: folderIds } }] : []),
        ],
      },
      select: { fileId: true, folderId: true },
    });

    const starred = new Set<string>();
    for (const star of stars) {
      if (star.fileId) starred.add(star.fileId);
      if (star.folderId) starred.add(star.folderId);
    }
    return starred;
  } catch {
    return new Set();
  }
}

export function applyStarredFlag<T extends ExplorerItemDto>(
  items: T[],
  starredIds: Set<string>,
): T[] {
  return items.map((item) => ({ ...item, starred: starredIds.has(item.id) }));
}

export async function toggleStar(
  context: RequestContext,
  subject: StarSubject,
): Promise<{ starred: boolean }> {
  const user = requireUser(context);

  if (subject.type === "FILE") {
    await resolveFileAccess(context, subject.id);
    const existing = await prisma.star.findFirst({
      where: { userId: user.id, fileId: subject.id },
      select: { id: true },
    });
    if (existing) {
      await prisma.star.delete({ where: { id: existing.id } });
      return { starred: false };
    }
    await prisma.star.create({
      data: { id: newId(), userId: user.id, fileId: subject.id },
    });
    return { starred: true };
  }

  await resolveFolderAccess(context, subject.id);
  const folder = await prisma.folder.findUnique({
    where: { id: subject.id },
    select: { parentId: true },
  });
  if (!folder) throw notFound("This folder no longer exists.");
  if (folder.parentId === null) {
    throw badRequest("Star individual folders or files — not the room root.");
  }

  const existing = await prisma.star.findFirst({
    where: { userId: user.id, folderId: subject.id },
    select: { id: true },
  });
  if (existing) {
    await prisma.star.delete({ where: { id: existing.id } });
    return { starred: false };
  }
  await prisma.star.create({
    data: { id: newId(), userId: user.id, folderId: subject.id },
  });
  return { starred: true };
}

export async function listStarredItems(context: RequestContext): Promise<StarredItemDto[]> {
  const user = requireUser(context);

  const stars = await prisma.star.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      file: {
        select: {
          id: true,
          name: true,
          folderId: true,
          dataRoomId: true,
          mimeType: true,
          size: true,
          versionCount: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          dataRoom: { select: { id: true, name: true, deletedAt: true } },
        },
      },
      folder: {
        select: {
          id: true,
          name: true,
          parentId: true,
          dataRoomId: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
          dataRoom: { select: { id: true, name: true, deletedAt: true } },
        },
      },
    },
  });

  const items: StarredItemDto[] = [];

  for (const star of stars) {
    if (star.file) {
      if (star.file.deletedAt || star.file.dataRoom.deletedAt) continue;
      const file = star.file;
      items.push({
        starId: star.id,
        starredAt: star.createdAt.toISOString(),
        dataRoomId: file.dataRoomId,
        dataRoomName: file.dataRoom.name,
        href: `/rooms/${file.dataRoomId}/files/${file.id}`,
        item: {
          kind: "file",
          id: file.id,
          name: file.name,
          folderId: file.folderId,
          dataRoomId: file.dataRoomId,
          mimeType: file.mimeType,
          size: file.size,
          versionCount: file.versionCount,
          createdAt: file.createdAt.toISOString(),
          updatedAt: file.updatedAt.toISOString(),
          starred: true,
        },
      });
      continue;
    }

    if (star.folder && star.folder.parentId !== null) {
      if (star.folder.deletedAt || star.folder.dataRoom.deletedAt) continue;
      const folder = star.folder;
      items.push({
        starId: star.id,
        starredAt: star.createdAt.toISOString(),
        dataRoomId: folder.dataRoomId,
        dataRoomName: folder.dataRoom.name,
        href: `/rooms/${folder.dataRoomId}/folders/${folder.id}`,
        item: {
          kind: "folder",
          id: folder.id,
          name: folder.name,
          parentId: folder.parentId,
          dataRoomId: folder.dataRoomId,
          createdAt: folder.createdAt.toISOString(),
          updatedAt: folder.updatedAt.toISOString(),
          starred: true,
        },
      });
    }
  }

  return items;
}
