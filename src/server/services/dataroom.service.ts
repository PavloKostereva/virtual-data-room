import { Role } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { newId } from "@/server/domain/id";
import { normaliseName } from "@/server/domain/naming";
import { buildRootPath } from "@/server/domain/paths";
import { notFound } from "@/server/errors";
import type { RequestContext } from "@/server/http/context";
import {
  requireDataRoomOwner,
  resolveDataRoomAccess,
  type AccessGrantInfo,
} from "@/server/services/access.service";
import type { DataRoomDto } from "@/types/dto";

const ROOT_FOLDER_NAME = "All files";

interface DataRoomRecord {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

async function toDataRoomDto(
  room: DataRoomRecord,
  access: AccessGrantInfo,
  totals: { fileCount: number; totalSize: number },
): Promise<DataRoomDto> {
  const root = await prisma.folder.findFirst({
    where: { dataRoomId: room.id, parentId: null },
    select: { id: true },
  });
  if (!root) throw notFound("This data room is missing its root folder.");

  return {
    id: room.id,
    name: room.name,
    description: room.description,
    rootFolderId: root.id,
    role: access.role,
    isOwner: access.role === Role.OWNER,
    fileCount: totals.fileCount,
    totalSize: totals.totalSize,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  };
}

export async function listOwnedDataRooms(userId: string): Promise<DataRoomDto[]> {
  const rooms = await prisma.dataRoom.findMany({
    where: { ownerId: userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (rooms.length === 0) return [];

  const totals = await prisma.file.groupBy({
    by: ["dataRoomId"],
    where: { dataRoomId: { in: rooms.map((room) => room.id) }, deletedAt: null },
    _count: { _all: true },
    _sum: { size: true },
  });
  const totalsByRoom = new Map(
    totals.map((entry) => [
      entry.dataRoomId,
      { fileCount: entry._count._all, totalSize: entry._sum.size ?? 0 },
    ]),
  );

  const roots = await prisma.folder.findMany({
    where: { dataRoomId: { in: rooms.map((room) => room.id) }, parentId: null },
    select: { id: true, dataRoomId: true },
  });
  const rootByRoom = new Map(roots.map((root) => [root.dataRoomId, root.id]));

  return rooms.map((room) => ({
    id: room.id,
    name: room.name,
    description: room.description,
    rootFolderId: rootByRoom.get(room.id) ?? "",
    role: Role.OWNER,
    isOwner: true,
    fileCount: totalsByRoom.get(room.id)?.fileCount ?? 0,
    totalSize: totalsByRoom.get(room.id)?.totalSize ?? 0,
    createdAt: room.createdAt.toISOString(),
    updatedAt: room.updatedAt.toISOString(),
  }));
}

export async function createDataRoom(
  userId: string,
  input: { name: string; description?: string | null },
): Promise<DataRoomDto> {
  const name = normaliseName(input.name);
  const roomId = newId();
  const rootId = newId();

  const room = await prisma.dataRoom.create({
    data: {
      id: roomId,
      name,
      description: input.description?.trim() || null,
      ownerId: userId,
      folders: {
        create: {
          id: rootId,
          parentId: null,
          name: ROOT_FOLDER_NAME,
          path: buildRootPath(rootId),
          depth: 0,
          createdById: userId,
        },
      },
    },
  });

  return toDataRoomDto(
    room,
    { role: Role.OWNER, source: "OWNER", boundary: { type: "DATA_ROOM", dataRoomId: room.id } },
    { fileCount: 0, totalSize: 0 },
  );
}

export async function getDataRoom(
  context: RequestContext,
  dataRoomId: string,
): Promise<DataRoomDto> {
  const { access } = await resolveDataRoomAccess(context, dataRoomId);
  const room = await prisma.dataRoom.findUniqueOrThrow({ where: { id: dataRoomId } });

  const totals = await prisma.file.aggregate({
    where: { dataRoomId, deletedAt: null },
    _count: { _all: true },
    _sum: { size: true },
  });

  return toDataRoomDto(room, access, {
    fileCount: totals._count._all,
    totalSize: totals._sum.size ?? 0,
  });
}

export async function renameDataRoom(
  context: RequestContext,
  dataRoomId: string,
  input: { name?: string; description?: string | null },
): Promise<DataRoomDto> {
  await requireDataRoomOwner(context, dataRoomId);

  await prisma.dataRoom.update({
    where: { id: dataRoomId },
    data: {
      ...(input.name !== undefined ? { name: normaliseName(input.name) } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
    },
  });

  return getDataRoom(context, dataRoomId);
}

export async function deleteDataRoom(
  context: RequestContext,
  dataRoomId: string,
): Promise<void> {
  await requireDataRoomOwner(context, dataRoomId);

  await prisma.dataRoom.update({
    where: { id: dataRoomId },
    data: {
      deletedAt: new Date(),
      deletedById: context.user?.id ?? null,
    },
  });
}
