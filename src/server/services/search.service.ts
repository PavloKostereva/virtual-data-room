import { prisma } from "@/server/db/prisma";
import { pathToIds } from "@/server/domain/paths";
import type { RequestContext } from "@/server/http/context";
import { resolveFolderAccess } from "@/server/services/access.service";
import { toFileDto } from "@/server/services/file.service";
import { toFolderDto } from "@/server/services/folder.service";
import type { SearchResultDto } from "@/types/dto";

export interface SearchParams {
  query: string;
  limit: number;
  kind: "all" | "file" | "folder";
}

const MIN_QUERY_LENGTH = 2;

export async function searchFolder(
  context: RequestContext,
  folderId: string,
  params: SearchParams,
): Promise<SearchResultDto[]> {
  const { folder: scope } = await resolveFolderAccess(context, folderId);

  const query = params.query.trim();
  if (query.length < MIN_QUERY_LENGTH) return [];

  const [folders, files] = await Promise.all([
    params.kind === "file"
      ? []
      : prisma.folder.findMany({
          where: {
            dataRoomId: scope.dataRoomId,
            path: { startsWith: scope.path },
            id: { not: scope.id },
            deletedAt: null,
            name: { contains: query, mode: "insensitive" },
          },
          orderBy: { name: "asc" },
          take: params.limit,
        }),
    params.kind === "folder"
      ? []
      : prisma.file.findMany({
          where: {
            dataRoomId: scope.dataRoomId,
            deletedAt: null,
            folder: { path: { startsWith: scope.path }, deletedAt: null },
            name: { contains: query, mode: "insensitive" },
          },
          orderBy: { name: "asc" },
          take: params.limit,
          include: { folder: { select: { id: true, path: true } } },
        }),
  ]);

  const location = await buildLocationResolver(scope.id, [
    ...folders.map((folder) => folder.path),
    ...files.map((file) => file.folder.path),
  ]);

  const results: SearchResultDto[] = [
    ...folders.map((folder) => ({
      item: toFolderDto(folder),
      location: location(folder.path, true),
      locationFolderId: folder.parentId ?? folder.id,
    })),
    ...files.map((file) => ({
      item: toFileDto(file),
      location: location(file.folder.path, false),
      locationFolderId: file.folderId,
    })),
  ];

  return results.slice(0, params.limit);
}

async function buildLocationResolver(scopeFolderId: string, paths: string[]) {
  const ids = new Set<string>();
  for (const path of paths) {
    for (const id of pathToIds(path)) ids.add(id);
  }

  const folders = await prisma.folder.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, name: true, parentId: true },
  });
  const nameById = new Map(
    folders.map((folder) => [folder.id, folder.parentId === null ? "All files" : folder.name]),
  );

  return (path: string, dropSelf: boolean): string[] => {
    const trail = dropSelf ? pathToIds(path).slice(0, -1) : pathToIds(path);
    const startIndex = trail.indexOf(scopeFolderId);
    return trail
      .slice(Math.max(startIndex, 0))
      .map((id) => nameById.get(id))
      .filter((name): name is string => Boolean(name));
  };
}