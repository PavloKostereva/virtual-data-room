import { Prisma, Role, type Folder } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { newId } from "@/server/domain/id";
import { nextAvailableName, normaliseName } from "@/server/domain/naming";
import { buildChildPath, pathToIds, toLikePrefix } from "@/server/domain/paths";
import { badRequest, conflict } from "@/server/errors";
import type { RequestContext } from "@/server/http/context";
import {
  assertCanWrite,
  resolveDataRoomAccess,
  resolveFolderAccess,
  type AccessGrantInfo,
} from "@/server/services/access.service";
import {
  applyStarredFlag,
  getStarredSubjectIds,
  type StarSubject,
} from "@/server/services/star.service";
import {
  buildKeysetFilter,
  buildOrderBy,
  cursorValue,
  decodeCursor,
  encodeCursor,
  mergeSortedItems,
  type SortDirection,
  type SortField,
} from "@/server/services/listing";
import { getStorage } from "@/server/storage";
import type {
  AccessDto,
  BreadcrumbDto,
  ExplorerItemDto,
  FolderDto,
  FolderStatsDto,
  FolderTreeNodeDto,
  FolderViewDto,
  PageDto,
} from "@/types/dto";

const MAX_DEPTH = 32;
const STORAGE_DELETE_BATCH = 500;

export function toFolderDto(folder: Folder): FolderDto {
  return {
    kind: "folder",
    id: folder.id,
    name: folder.name,
    parentId: folder.parentId,
    dataRoomId: folder.dataRoomId,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  };
}

export function toAccessDto(access: AccessGrantInfo): AccessDto {
  return {
    role: access.role,
    isOwner: access.role === Role.OWNER,
    canWrite: access.role === Role.OWNER || access.role === Role.EDITOR,
    canShare: access.role === Role.OWNER,
    boundaryFolderId: access.boundary.type === "FOLDER" ? access.boundary.folderId : null,
  };
}

export async function buildBreadcrumbs(
  folder: Folder,
  access: AccessGrantInfo,
): Promise<BreadcrumbDto[]> {
  if (access.boundary.type === "FILE") return [];

  const ids = pathToIds(folder.path);
  const boundaryIndex =
    access.boundary.type === "FOLDER" ? ids.indexOf(access.boundary.folderId) : 0;
  const visibleIds = ids.slice(Math.max(boundaryIndex, 0));

  const folders = await prisma.folder.findMany({
    where: { id: { in: visibleIds } },
    select: { id: true, name: true, parentId: true },
  });

  const byId = new Map(folders.map((entry) => [entry.id, entry]));

  return visibleIds.flatMap((id) => {
    const entry = byId.get(id);
    if (!entry) return [];

    return [{ id: entry.id, name: entry.parentId === null ? "All files" : entry.name }];
  });
}

export async function getFolderView(
  context: RequestContext,
  folderId: string,
): Promise<FolderViewDto> {
  const { folder, dataRoom, access } = await resolveFolderAccess(context, folderId);
  const breadcrumbs = await buildBreadcrumbs(folder, access);

  return {
    dataRoom: { id: dataRoom.id, name: dataRoom.name },
    folder: toFolderDto(folder),
    breadcrumbs,
    access: toAccessDto(access),
  };
}

/** Single access check, then breadcrumbs + children in parallel. */
export async function getFolderExplorer(
  context: RequestContext,
  folderId: string,
  params: ListChildrenParams,
): Promise<{ view: FolderViewDto; children: PageDto<ExplorerItemDto> }> {
  const { folder, dataRoom, access } = await resolveFolderAccess(context, folderId);

  const [breadcrumbs, children] = await Promise.all([
    buildBreadcrumbs(folder, access),
    listChildrenForFolder(folderId, params),
  ]);

  const withStars = await attachStarredFlags(context, children.items);

  return {
    view: {
      dataRoom: { id: dataRoom.id, name: dataRoom.name },
      folder: toFolderDto(folder),
      breadcrumbs,
      access: toAccessDto(access),
    },
    children: { ...children, items: withStars },
  };
}

export interface ListChildrenParams {
  sort: SortField;
  direction: SortDirection;
  limit: number;
  cursor?: string | null;
}

async function listChildrenForFolder(
  folderId: string,
  params: ListChildrenParams,
): Promise<PageDto<ExplorerItemDto>> {
  const { sort, direction, limit } = params;
  const cursor = decodeCursor(params.cursor);
  const take = limit + 1;
  const keyset = buildKeysetFilter(sort, direction, cursor);

  const [folders, files] = await Promise.all([
    prisma.folder.findMany({
      where: { parentId: folderId, deletedAt: null, ...keyset },
      orderBy: buildOrderBy(sort, direction),
      take,
    }),
    prisma.file.findMany({
      where: { folderId, deletedAt: null, ...keyset },
      orderBy: buildOrderBy(sort, direction),
      take,
    }),
  ]);

  const merged = mergeSortedItems<ExplorerItemDto>(
    folders.map(toFolderDto),
    files.map((file) => ({
      kind: "file" as const,
      id: file.id,
      name: file.name,
      folderId: file.folderId,
      dataRoomId: file.dataRoomId,
      mimeType: file.mimeType,
      size: file.size,
      versionCount: file.versionCount,
      createdAt: file.createdAt.toISOString(),
      updatedAt: file.updatedAt.toISOString(),
    })),
    sort,
    direction,
  );

  const page = merged.slice(0, limit);
  const last = page[page.length - 1];

  return {
    items: page,
    nextCursor:
      merged.length > limit && last
        ? encodeCursor({
            kind: last.kind === "folder" ? "folder" : "file",
            value: cursorValue(sort, last),
            id: last.id,
          })
        : null,
  };
}

export async function listChildren(
  context: RequestContext,
  folderId: string,
  params: ListChildrenParams,
): Promise<PageDto<ExplorerItemDto>> {
  await resolveFolderAccess(context, folderId);
  const page = await listChildrenForFolder(folderId, params);
  return { ...page, items: await attachStarredFlags(context, page.items) };
}

async function attachStarredFlags(
  context: RequestContext,
  items: ExplorerItemDto[],
): Promise<ExplorerItemDto[]> {
  if (!context.user || items.length === 0) return items;
  const subjects: StarSubject[] = items.map((item) =>
    item.kind === "file" ? { type: "FILE", id: item.id } : { type: "FOLDER", id: item.id },
  );
  const starredIds = await getStarredSubjectIds(context.user.id, subjects);
  return applyStarredFlag(items, starredIds);
}

export async function createFolder(
  context: RequestContext,
  input: { parentId: string; name: string },
): Promise<FolderDto> {
  const { folder: parent, access } = await resolveFolderAccess(context, input.parentId);
  assertCanWrite(access);

  if (parent.depth + 1 > MAX_DEPTH) {
    throw badRequest(`Folders cannot be nested more than ${MAX_DEPTH} levels deep.`);
  }

  const name = normaliseName(input.name);
  const id = newId();

  try {
    const created = await prisma.folder.create({
      data: {
        id,
        name,
        dataRoomId: parent.dataRoomId,
        parentId: parent.id,
        path: buildChildPath(parent.path, id),
        depth: parent.depth + 1,
        createdById: context.user?.id ?? null,
      },
    });
    return toFolderDto(created);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(`A folder named “${name}” already exists here.`);
    }
    throw error;
  }
}

export async function renameFolder(
  context: RequestContext,
  folderId: string,
  rawName: string,
): Promise<FolderDto> {
  const { folder, access } = await resolveFolderAccess(context, folderId);
  assertCanWrite(access);

  if (folder.parentId === null) {
    throw badRequest("Rename the data room instead of its root folder.");
  }

  const name = normaliseName(rawName);
  if (name === folder.name) return toFolderDto(folder);

  try {
    const updated = await prisma.folder.update({ where: { id: folderId }, data: { name } });
    return toFolderDto(updated);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(`A folder named “${name}” already exists here.`);
    }
    throw error;
  }
}

export async function moveFolder(
  context: RequestContext,
  folderId: string,
  targetParentId: string,
): Promise<FolderDto> {
  const [{ folder, access }, target] = await Promise.all([
    resolveFolderAccess(context, folderId),
    resolveFolderAccess(context, targetParentId),
  ]);
  assertCanWrite(access);
  assertCanWrite(target.access);

  if (folder.parentId === null) throw badRequest("The root folder cannot be moved.");
  if (folder.dataRoomId !== target.folder.dataRoomId) {
    throw badRequest("Items can only be moved within the same data room.");
  }
  if (folder.id === target.folder.id) throw badRequest("A folder cannot be moved into itself.");
  if (target.folder.path.startsWith(folder.path)) {
    throw badRequest("A folder cannot be moved into one of its own subfolders.");
  }
  if (folder.parentId === target.folder.id) return toFolderDto(folder);

  const oldPath = folder.path;
  const newPath = buildChildPath(target.folder.path, folder.id);
  const depthDelta = target.folder.depth + 1 - folder.depth;
  const pathStart = oldPath.length + 1;

  const sibling = await prisma.folder.findFirst({
    where: { parentId: target.folder.id, name: folder.name, deletedAt: null },
    select: { id: true },
  });
  if (sibling) throw conflict(`A folder named “${folder.name}” already exists there.`);

  const deepest = await prisma.folder.aggregate({
    where: { dataRoomId: folder.dataRoomId, path: { startsWith: folder.path } },
    _max: { depth: true },
  });
  const extraDepth = (deepest._max.depth ?? folder.depth) - folder.depth;
  if (target.folder.depth + 1 + extraDepth > MAX_DEPTH) {
    throw badRequest(`Folders cannot be nested more than ${MAX_DEPTH} levels deep.`);
  }

  let updated;
  try {
    updated = await prisma.folder.update({
      where: { id: folderId },
      data: {
        parentId: target.folder.id,
        path: newPath,
        depth: folder.depth + depthDelta,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw conflict(`A folder named “${folder.name}” already exists there.`);
    }
    throw error;
  }

  if (extraDepth > 0) {
    await prisma.$executeRaw`
      UPDATE "Folder"
      SET
        "path" = ${newPath} || substring("path" from ${pathStart}),
        "depth" = "depth" + ${depthDelta},
        "updatedAt" = NOW()
      WHERE "dataRoomId" = ${folder.dataRoomId}
        AND "id" <> ${folderId}
        AND "path" LIKE ${toLikePrefix(oldPath)}
    `;
  }

  return toFolderDto(updated);
}

export async function getFolderStats(
  context: RequestContext,
  folderId: string,
): Promise<FolderStatsDto> {
  const { folder } = await resolveFolderAccess(context, folderId);
  return computeSubtreeStats(folder);
}

export async function computeSubtreeStats(folder: Folder): Promise<FolderStatsDto> {
  const rows = await prisma.$queryRaw<
    Array<{ folder_count: bigint; file_count: bigint; total_size: bigint }>
  >`
    WITH subtree AS (
      SELECT "id" FROM "Folder"
      WHERE "dataRoomId" = ${folder.dataRoomId}
        AND "path" LIKE ${toLikePrefix(folder.path)}
        AND "deletedAt" IS NULL
    )
    SELECT
      (SELECT COUNT(*) FROM subtree) - 1                                        AS folder_count,
      COALESCE((SELECT COUNT(*) FROM "File"
                WHERE "folderId" IN (SELECT "id" FROM subtree)
                  AND "deletedAt" IS NULL), 0)                                  AS file_count,
      COALESCE((SELECT SUM("size") FROM "File"
                WHERE "folderId" IN (SELECT "id" FROM subtree)
                  AND "deletedAt" IS NULL), 0)                                  AS total_size
  `;

  const row = rows[0];
  return {
    folderCount: Number(row?.folder_count ?? 0),
    fileCount: Number(row?.file_count ?? 0),
    totalSize: Number(row?.total_size ?? 0),
  };
}

export async function deleteFolder(context: RequestContext, folderId: string): Promise<void> {
  const { folder, access } = await resolveFolderAccess(context, folderId);
  assertCanWrite(access);

  if (folder.parentId === null) {
    throw badRequest("The root folder cannot be deleted. Delete the data room instead.");
  }

  const now = new Date();
  const deletedById = context.user?.id ?? null;

  await prisma.$transaction([
    prisma.folder.updateMany({
      where: {
        dataRoomId: folder.dataRoomId,
        path: { startsWith: folder.path },
        deletedAt: null,
      },
      data: { deletedAt: now, deletedById },
    }),
    prisma.file.updateMany({
      where: {
        dataRoomId: folder.dataRoomId,
        deletedAt: null,
        folder: { path: { startsWith: folder.path } },
      },
      data: { deletedAt: now, deletedById },
    }),
  ]);
}

export async function removeSubtreeObjects(folder: Folder): Promise<void> {
  const storage = getStorage();
  let cursorId: string | undefined;

  for (;;) {
    const versions = await prisma.fileVersion.findMany({
      where: {
        file: {
          dataRoomId: folder.dataRoomId,
          folder: { path: { startsWith: folder.path } },
        },
      },
      select: { id: true, storageKey: true },
      orderBy: { id: "asc" },
      take: STORAGE_DELETE_BATCH,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });

    if (versions.length === 0) break;

    await storage.remove(versions.map((version) => version.storageKey));
    cursorId = versions[versions.length - 1]?.id;
    if (versions.length < STORAGE_DELETE_BATCH) break;
  }
}

export async function getFolderTree(
  context: RequestContext,
  dataRoomId: string,
  limit = 2000,
): Promise<FolderTreeNodeDto[]> {
  await resolveDataRoomAccess(context, dataRoomId);

  const folders = await prisma.folder.findMany({
    where: { dataRoomId, deletedAt: null },
    select: { id: true, name: true, parentId: true, path: true },
    orderBy: [{ depth: "asc" }, { name: "asc" }],
    take: limit,
  });

  const parentsWithChildren = new Set(
    folders.map((folder) => folder.parentId).filter((id): id is string => id !== null),
  );

  return folders.map((folder) => ({
    id: folder.id,
    name: folder.parentId === null ? "All files" : folder.name,
    parentId: folder.parentId,
    hasChildren: parentsWithChildren.has(folder.id),
  }));
}

export async function takenChildFolderNames(parentId: string): Promise<string[]> {
  const folders = await prisma.folder.findMany({
    where: { parentId, deletedAt: null },
    select: { name: true },
  });
  return folders.map((folder) => folder.name);
}

export async function suggestFolderName(parentId: string, desired: string): Promise<string> {
  return nextAvailableName(desired, await takenChildFolderNames(parentId));
}

export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
