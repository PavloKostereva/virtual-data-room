import type { File } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { newId } from "@/server/domain/id";
import { nextAvailableName, normaliseName } from "@/server/domain/naming";
import { env } from "@/server/env";
import { badRequest, conflict, notFound, payloadTooLarge, unsupportedMediaType } from "@/server/errors";
import type { RequestContext } from "@/server/http/context";
import { assertCanWrite, resolveFileAccess, resolveFolderAccess } from "@/server/services/access.service";
import { buildBreadcrumbs, toAccessDto } from "@/server/services/folder.service";
import { buildStorageKey, getStorage } from "@/server/storage";
import type { FileDetailDto, FileDto, UploadTicketDto } from "@/types/dto";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export type ConflictStrategy = "fail" | "rename" | "version";

export function toFileDto(file: File): FileDto {
  return {
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
  };
}

export async function createUploadTicket(
  context: RequestContext,
  input: { folderId: string; fileName: string; mimeType: string; size: number },
): Promise<UploadTicketDto> {
  const { folder, access } = await resolveFolderAccess(context, input.folderId);
  assertCanWrite(access);

  if (!ALLOWED_MIME_TYPES.has(input.mimeType)) {
    throw unsupportedMediaType(`Files of type “${input.mimeType}” are not supported.`);
  }
  if (input.size <= 0) throw badRequest("Empty files cannot be uploaded.");
  if (input.size > env.MAX_UPLOAD_BYTES) {
    throw payloadTooLarge(
      `Files must be smaller than ${Math.floor(env.MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`,
    );
  }

  normaliseName(input.fileName);

  const key = buildStorageKey({ dataRoomId: folder.dataRoomId, fileName: input.fileName });
  const ticket = await getStorage().createUploadUrl({
    key,
    contentType: input.mimeType,
    contentLength: input.size,
  });

  return {
    url: ticket.url,
    method: ticket.method,
    headers: ticket.headers,
    storageKey: ticket.key,
    expiresAt: ticket.expiresAt,
  };
}

export interface FinalizeUploadInput {
  folderId: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  conflictStrategy: ConflictStrategy;
}

export interface FinalizeUploadResult {
  file: FileDto;

  resolution: "created" | "renamed" | "versioned";
}

export async function finalizeUpload(
  context: RequestContext,
  input: FinalizeUploadInput,
): Promise<FinalizeUploadResult> {
  const { folder, access } = await resolveFolderAccess(context, input.folderId);
  assertCanWrite(access);

  const name = normaliseName(input.fileName);
  const storage = getStorage();
  const object = await storage.stat(input.storageKey);
  if (!object) throw badRequest("The upload did not complete. Please try again.");
  if (object.size > env.MAX_UPLOAD_BYTES) {
    await storage.remove([input.storageKey]);
    throw payloadTooLarge("The uploaded file is too large.");
  }

  const existing = await prisma.file.findFirst({
    where: { folderId: folder.id, name, deletedAt: null },
    select: { id: true, versionCount: true },
  });

  if (existing && input.conflictStrategy === "fail") {
    const suggestion = nextAvailableName(name, await takenFileNames(folder.id));
    throw conflict(`A file named “${name}” already exists here.`, {
      existingFileId: existing.id,
      suggestedName: suggestion,
    });
  }

  if (existing && input.conflictStrategy === "version") {
    const versionId = newId();
    const [, file] = await prisma.$transaction([
      prisma.fileVersion.create({
        data: {
          id: versionId,
          fileId: existing.id,
          versionNumber: existing.versionCount + 1,
          size: object.size,
          mimeType: input.mimeType,
          storageKey: input.storageKey,
          uploadedById: context.user?.id ?? null,
        },
      }),
      prisma.file.update({
        where: { id: existing.id },
        data: {
          currentVersionId: versionId,
          size: object.size,
          mimeType: input.mimeType,
          versionCount: { increment: 1 },
        },
      }),
    ]);

    return { file: toFileDto(file), resolution: "versioned" };
  }

  const finalName =
    existing && input.conflictStrategy === "rename"
      ? nextAvailableName(name, await takenFileNames(folder.id))
      : name;

  const file = await createFileWithVersion({
    dataRoomId: folder.dataRoomId,
    folderId: folder.id,
    name: finalName,
    mimeType: input.mimeType,
    size: object.size,
    storageKey: input.storageKey,
    userId: context.user?.id ?? null,
  });

  return { file: toFileDto(file), resolution: finalName === name ? "created" : "renamed" };
}

async function createFileWithVersion(input: {
  dataRoomId: string;
  folderId: string;
  name: string;
  mimeType: string;
  size: number;
  storageKey: string;
  userId: string | null;
}): Promise<File> {
  const fileId = newId();
  const versionId = newId();

  const [, file] = await prisma.$transaction([
    prisma.file.create({
      data: {
        id: fileId,
        dataRoomId: input.dataRoomId,
        folderId: input.folderId,
        name: input.name,
        mimeType: input.mimeType,
        size: input.size,
        createdById: input.userId,
        versionCount: 1,
        versions: {
          create: {
            id: versionId,
            versionNumber: 1,
            size: input.size,
            mimeType: input.mimeType,
            storageKey: input.storageKey,
            uploadedById: input.userId,
          },
        },
      },
    }),
    prisma.file.update({
      where: { id: fileId },
      data: { currentVersionId: versionId },
    }),
  ]);

  return file;
}

export async function renameFile(
  context: RequestContext,
  fileId: string,
  rawName: string,
  strategy: ConflictStrategy = "fail",
): Promise<FileDto> {
  const { file, access } = await resolveFileAccess(context, fileId);
  assertCanWrite(access);

  const name = normaliseName(rawName);
  if (name === file.name) return toFileDto(file);

  const clash = await prisma.file.findFirst({
    where: { folderId: file.folderId, name, id: { not: file.id }, deletedAt: null },
    select: { id: true },
  });

  if (clash) {
    if (strategy === "fail") {
      throw conflict(`A file named “${name}” already exists here.`, {
        existingFileId: clash.id,
        suggestedName: nextAvailableName(name, await takenFileNames(file.folderId)),
      });
    }
    const resolved = nextAvailableName(name, await takenFileNames(file.folderId));
    const updated = await prisma.file.update({
      where: { id: fileId },
      data: { name: resolved },
    });
    return toFileDto(updated);
  }

  const updated = await prisma.file.update({ where: { id: fileId }, data: { name } });
  return toFileDto(updated);
}

export async function moveFile(
  context: RequestContext,
  fileId: string,
  targetFolderId: string,
  strategy: ConflictStrategy = "fail",
): Promise<FileDto> {
  const { file, access } = await resolveFileAccess(context, fileId);
  assertCanWrite(access);

  const target = await resolveFolderAccess(context, targetFolderId);
  assertCanWrite(target.access);

  if (target.folder.dataRoomId !== file.dataRoomId) {
    throw badRequest("Files can only be moved within the same data room.");
  }
  if (target.folder.id === file.folderId) return toFileDto(file);

  const clash = await prisma.file.findFirst({
    where: { folderId: target.folder.id, name: file.name, deletedAt: null },
    select: { id: true },
  });

  let name = file.name;
  if (clash) {
    if (strategy === "fail") {
      throw conflict(`“${file.name}” already exists in that folder.`, {
        existingFileId: clash.id,
        suggestedName: nextAvailableName(file.name, await takenFileNames(target.folder.id)),
      });
    }
    name = nextAvailableName(file.name, await takenFileNames(target.folder.id));
  }

  const updated = await prisma.file.update({
    where: { id: fileId },
    data: { folderId: target.folder.id, name },
  });
  return toFileDto(updated);
}

export async function deleteFile(context: RequestContext, fileId: string): Promise<void> {
  const { access } = await resolveFileAccess(context, fileId);
  assertCanWrite(access);

  await prisma.file.update({
    where: { id: fileId },
    data: {
      deletedAt: new Date(),
      deletedById: context.user?.id ?? null,
    },
  });
}

export async function getFileDetail(
  context: RequestContext,
  fileId: string,
): Promise<FileDetailDto> {
  const { file, access } = await resolveFileAccess(context, fileId);

  const [dataRoom, versions, breadcrumbs] = await Promise.all([
    prisma.dataRoom.findUniqueOrThrow({
      where: { id: file.dataRoomId },
      select: { id: true, name: true },
    }),
    prisma.fileVersion.findMany({
      where: { fileId },
      orderBy: { versionNumber: "desc" },
      select: {
        id: true,
        versionNumber: true,
        size: true,
        createdAt: true,
        uploadedBy: { select: { name: true } },
      },
    }),
    buildBreadcrumbs(file.folder, access),
  ]);

  return {
    ...toFileDto(file),
    dataRoom,
    breadcrumbs,
    access: toAccessDto(access),
    versions: versions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      size: version.size,
      createdAt: version.createdAt.toISOString(),
      isCurrent: version.id === file.currentVersionId,
      uploadedBy: version.uploadedBy?.name ?? null,
    })),
  };
}

export async function getFileContentUrl(
  context: RequestContext,
  fileId: string,
  options: { disposition: "inline" | "attachment"; versionId?: string },
): Promise<string> {
  const { file } = await resolveFileAccess(context, fileId);

  const version = await prisma.fileVersion.findFirst({
    where: options.versionId
      ? { id: options.versionId, fileId }
      : { id: file.currentVersionId ?? "" },
    select: { storageKey: true, mimeType: true },
  });
  if (!version) throw notFound("The stored file could not be found.");

  return getStorage().createDownloadUrl({
    key: version.storageKey,
    fileName: file.name,
    contentType: version.mimeType,
    disposition: options.disposition,
  });
}

export async function takenFileNames(folderId: string): Promise<string[]> {
  const files = await prisma.file.findMany({
    where: { folderId, deletedAt: null },
    select: { name: true },
  });
  return files.map((file) => file.name);
}
