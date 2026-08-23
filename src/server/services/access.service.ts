import { Role, ShareSubjectType, type File, type Folder, type Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { pathToIds } from "@/server/domain/paths";
import { forbidden, notFound } from "@/server/errors";
import type { RequestContext } from "@/server/http/context";

export type AccessSource = "OWNER" | "PUBLIC_LINK" | "GRANT";

export type AccessBoundary =
  | { type: "DATA_ROOM"; dataRoomId: string }
  | { type: "FOLDER"; folderId: string }
  | { type: "FILE"; fileId: string };

export interface AccessGrantInfo {
  role: Role;
  source: AccessSource;
  boundary: AccessBoundary;
  shareId?: string;
}

const ROLE_RANK: Record<Role, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };

export function canWrite(access: AccessGrantInfo): boolean {
  return ROLE_RANK[access.role] >= ROLE_RANK[Role.EDITOR];
}

export function assertCanWrite(access: AccessGrantInfo): void {
  if (!canWrite(access)) throw forbidden("You have read-only access to this item.");
}

export function assertCanManageSharing(access: AccessGrantInfo): void {
  if (access.role !== Role.OWNER) throw forbidden("Only the owner can manage sharing.");
}

interface ShareLookupParams {
  dataRoomId: string;
  folderIds: readonly string[];
  fileId?: string;
}

async function resolveShareAccess(
  context: RequestContext,
  params: ShareLookupParams,
): Promise<AccessGrantInfo | null> {
  const audiences: Prisma.ShareWhereInput[] = [];

  if (context.shareToken) {
    audiences.push({ mode: "PUBLIC_LINK", token: context.shareToken });
  }
  if (context.user) {
    audiences.push({
      mode: "RESTRICTED",
      grants: { some: { email: context.user.email, revokedAt: null } },
    });
  }
  if (audiences.length === 0) return null;

  const subjects: Prisma.ShareWhereInput[] = [{ subjectType: ShareSubjectType.DATA_ROOM }];
  if (params.folderIds.length > 0) {
    subjects.push({ subjectType: ShareSubjectType.FOLDER, folderId: { in: [...params.folderIds] } });
  }
  if (params.fileId) {
    subjects.push({ subjectType: ShareSubjectType.FILE, fileId: params.fileId });
  }

  const shares = await prisma.share.findMany({
    where: {
      dataRoomId: params.dataRoomId,
      revokedAt: null,
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
        { OR: subjects },
        { OR: audiences },
      ],
    },
    select: {
      id: true,
      role: true,
      mode: true,
      subjectType: true,
      folderId: true,
      fileId: true,
      dataRoomId: true,
      grants: {
        where: { email: context.user?.email ?? "", revokedAt: null },
        select: { role: true },
        take: 1,
      },
    },
  });

  let best: AccessGrantInfo | null = null;

  for (const share of shares) {
    const grantRole = share.grants[0]?.role;
    const role = share.mode === "RESTRICTED" ? (grantRole ?? share.role) : share.role;

    const boundary: AccessBoundary =
      share.subjectType === ShareSubjectType.FOLDER && share.folderId
        ? { type: "FOLDER", folderId: share.folderId }
        : share.subjectType === ShareSubjectType.FILE && share.fileId
          ? { type: "FILE", fileId: share.fileId }
          : { type: "DATA_ROOM", dataRoomId: share.dataRoomId };

    const candidate: AccessGrantInfo = {
      role,
      source: share.mode === "PUBLIC_LINK" ? "PUBLIC_LINK" : "GRANT",
      boundary,
      shareId: share.id,
    };

    if (!best || ROLE_RANK[candidate.role] > ROLE_RANK[best.role]) best = candidate;
  }

  return best;
}

export interface DataRoomInfo {
  id: string;
  name: string;
  ownerId: string;
  description: string | null;
}

export interface DataRoomAccess {
  dataRoom: DataRoomInfo;
  access: AccessGrantInfo;
}

export async function resolveDataRoomAccess(
  context: RequestContext,
  dataRoomId: string,
  options?: { includeDeleted?: boolean },
): Promise<DataRoomAccess> {
  const dataRoom = await prisma.dataRoom.findUnique({
    where: { id: dataRoomId },
    select: { id: true, name: true, ownerId: true, description: true, deletedAt: true },
  });
  if (!dataRoom) throw notFound("This data room no longer exists.");
  if (dataRoom.deletedAt && !options?.includeDeleted) {
    throw notFound("This data room no longer exists.");
  }

  const { deletedAt: _deletedAt, ...dataRoomInfo } = dataRoom;

  if (context.user?.id === dataRoom.ownerId) {
    return {
      dataRoom: dataRoomInfo,
      access: { role: Role.OWNER, source: "OWNER", boundary: { type: "DATA_ROOM", dataRoomId } },
    };
  }

  const shared = await resolveShareAccess(context, { dataRoomId, folderIds: [] });
  if (!shared) throw notFound("This data room no longer exists.");

  return { dataRoom: dataRoomInfo, access: shared };
}

export interface FolderAccess {
  folder: Folder;
  dataRoom: DataRoomInfo;
  access: AccessGrantInfo;
}

export async function resolveFolderAccess(
  context: RequestContext,
  folderId: string,
  options?: { includeDeleted?: boolean },
): Promise<FolderAccess> {
  const row = await prisma.folder.findUnique({
    where: { id: folderId },
    include: {
      dataRoom: { select: { id: true, name: true, ownerId: true, description: true, deletedAt: true } },
    },
  });
  if (!row) throw notFound("This folder no longer exists.");
  if ((row.deletedAt || row.dataRoom.deletedAt) && !options?.includeDeleted) {
    throw notFound("This folder no longer exists.");
  }

  const { dataRoom: roomRow, ...folder } = row;
  const { deletedAt: _roomDeletedAt, ...dataRoom } = roomRow;

  if (context.user?.id === dataRoom.ownerId) {
    return {
      folder,
      dataRoom,
      access: {
        role: Role.OWNER,
        source: "OWNER",
        boundary: { type: "DATA_ROOM", dataRoomId: folder.dataRoomId },
      },
    };
  }

  const shared = await resolveShareAccess(context, {
    dataRoomId: folder.dataRoomId,
    folderIds: pathToIds(folder.path),
  });

  if (!shared || shared.boundary.type === "FILE") throw notFound("This folder no longer exists.");

  return { folder, dataRoom, access: shared };
}

export interface FileAccess {
  file: File & { folder: Folder };
  dataRoom: DataRoomInfo;
  access: AccessGrantInfo;
}

export async function resolveFileAccess(
  context: RequestContext,
  fileId: string,
  options?: { includeDeleted?: boolean },
): Promise<FileAccess> {
  const row = await prisma.file.findUnique({
    where: { id: fileId },
    include: {
      folder: true,
      dataRoom: { select: { id: true, name: true, ownerId: true, description: true, deletedAt: true } },
    },
  });
  if (!row) throw notFound("This file no longer exists.");
  if ((row.deletedAt || row.folder.deletedAt || row.dataRoom.deletedAt) && !options?.includeDeleted) {
    throw notFound("This file no longer exists.");
  }

  const { dataRoom: roomRow, ...file } = row;
  const { deletedAt: _roomDeletedAt, ...dataRoom } = roomRow;

  if (context.user?.id === dataRoom.ownerId) {
    return {
      file,
      dataRoom,
      access: {
        role: Role.OWNER,
        source: "OWNER",
        boundary: { type: "DATA_ROOM", dataRoomId: file.dataRoomId },
      },
    };
  }

  const shared = await resolveShareAccess(context, {
    dataRoomId: file.dataRoomId,
    folderIds: pathToIds(file.folder.path),
    fileId: file.id,
  });
  if (!shared) throw notFound("This file no longer exists.");

  return { file, dataRoom, access: shared };
}

export async function requireDataRoomOwner(
  context: RequestContext,
  dataRoomId: string,
  options?: { includeDeleted?: boolean },
) {
  const { dataRoom, access } = await resolveDataRoomAccess(context, dataRoomId, options);
  if (access.role !== Role.OWNER) throw forbidden("Only the owner can do that.");
  return dataRoom;
}
