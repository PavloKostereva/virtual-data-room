import { Role, ShareMode, ShareSubjectType, type Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { newId, newShareToken } from "@/server/domain/id";
import { env } from "@/server/env";
import { badRequest, notFound } from "@/server/errors";
import type { RequestContext } from "@/server/http/context";
import {
  assertCanManageSharing,
  resolveDataRoomAccess,
  resolveFileAccess,
  resolveFolderAccess,
} from "@/server/services/access.service";
import type { ShareDto, SharedWithMeItemDto } from "@/types/dto";

export interface ShareSubject {
  type: ShareSubjectType;
  id: string;
}

interface ResolvedSubject {
  dataRoomId: string;
  name: string;
  where: Prisma.ShareWhereInput;
  create: { subjectType: ShareSubjectType; folderId: string | null; fileId: string | null };
  href: string;
}

async function resolveSubject(
  context: RequestContext,
  subject: ShareSubject,
): Promise<ResolvedSubject> {
  if (subject.type === ShareSubjectType.DATA_ROOM) {
    const { dataRoom, access } = await resolveDataRoomAccess(context, subject.id);
    assertCanManageSharing(access);
    return {
      dataRoomId: dataRoom.id,
      name: dataRoom.name,
      where: { dataRoomId: dataRoom.id, subjectType: ShareSubjectType.DATA_ROOM },
      create: { subjectType: ShareSubjectType.DATA_ROOM, folderId: null, fileId: null },
      href: `/rooms/${dataRoom.id}`,
    };
  }

  if (subject.type === ShareSubjectType.FOLDER) {
    const { folder, access } = await resolveFolderAccess(context, subject.id);
    assertCanManageSharing(access);
    return {
      dataRoomId: folder.dataRoomId,
      name: folder.parentId === null ? "All files" : folder.name,
      where: { subjectType: ShareSubjectType.FOLDER, folderId: folder.id },
      create: { subjectType: ShareSubjectType.FOLDER, folderId: folder.id, fileId: null },
      href: `/rooms/${folder.dataRoomId}/folders/${folder.id}`,
    };
  }

  const { file, access } = await resolveFileAccess(context, subject.id);
  assertCanManageSharing(access);
  return {
    dataRoomId: file.dataRoomId,
    name: file.name,
    where: { subjectType: ShareSubjectType.FILE, fileId: file.id },
    create: { subjectType: ShareSubjectType.FILE, folderId: null, fileId: file.id },
    href: `/rooms/${file.dataRoomId}/files/${file.id}`,
  };
}

const shareSelect = {
  id: true,
  mode: true,
  role: true,
  subjectType: true,
  folderId: true,
  fileId: true,
  dataRoomId: true,
  token: true,
  expiresAt: true,
  createdAt: true,
  grants: {
    where: { revokedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, role: true, createdAt: true },
  },
} satisfies Prisma.ShareSelect;

type ShareRow = Prisma.ShareGetPayload<{ select: typeof shareSelect }>;

function toShareDto(share: ShareRow, subjectName: string): ShareDto {
  const subjectId =
    share.subjectType === ShareSubjectType.FOLDER
      ? (share.folderId ?? "")
      : share.subjectType === ShareSubjectType.FILE
        ? (share.fileId ?? "")
        : share.dataRoomId;

  return {
    id: share.id,
    mode: share.mode,
    role: share.role,
    subjectType: share.subjectType,
    subjectId,
    subjectName,
    url: share.token ? `${env.NEXT_PUBLIC_APP_URL}/share/${share.token}` : null,
    expiresAt: share.expiresAt?.toISOString() ?? null,
    createdAt: share.createdAt.toISOString(),
    grants: share.grants.map((grant) => ({
      id: grant.id,
      email: grant.email,
      role: grant.role,
      createdAt: grant.createdAt.toISOString(),
    })),
  };
}

export async function listSharesForSubject(
  context: RequestContext,
  subject: ShareSubject,
): Promise<ShareDto[]> {
  const resolved = await resolveSubject(context, subject);

  const shares = await prisma.share.findMany({
    where: { ...resolved.where, revokedAt: null },
    select: shareSelect,
    orderBy: { createdAt: "asc" },
  });

  return shares.map((share) => toShareDto(share, resolved.name));
}

async function getOrCreateShare(
  context: RequestContext,
  subject: ShareSubject,
  mode: ShareMode,
  role: Role,
  options: { expiresAt?: Date | null } = {},
): Promise<ShareDto> {
  const resolved = await resolveSubject(context, subject);

  const existing = await prisma.share.findFirst({
    where: { ...resolved.where, mode, revokedAt: null },
    select: shareSelect,
  });
  if (existing) return toShareDto(existing, resolved.name);

  const created = await prisma.share.create({
    data: {
      id: newId(),
      dataRoomId: resolved.dataRoomId,
      ...resolved.create,
      mode,
      role,
      token: mode === ShareMode.PUBLIC_LINK ? newShareToken() : null,
      expiresAt: options.expiresAt ?? null,
      createdById: context.user?.id ?? null,
    },
    select: shareSelect,
  });

  return toShareDto(created, resolved.name);
}

export function createPublicLink(
  context: RequestContext,
  subject: ShareSubject,
  options: { expiresInDays?: 1 | 7 | 30 | 90 | null } = {},
) {
  const expiresAt =
    options.expiresInDays != null
      ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
      : null;
  return getOrCreateShare(context, subject, ShareMode.PUBLIC_LINK, Role.VIEWER, { expiresAt });
}

export async function addRecipients(
  context: RequestContext,
  subject: ShareSubject,
  emails: string[],
  role: Role = Role.VIEWER,
): Promise<ShareDto> {
  const share = await getOrCreateShare(context, subject, ShareMode.RESTRICTED, role);
  const owner = context.user;

  const normalised = [...new Set(emails.map((email) => email.trim().toLowerCase()))].filter(
    Boolean,
  );
  if (normalised.length === 0) throw badRequest("Enter at least one email address.");
  if (owner && normalised.includes(owner.email)) {
    throw badRequest("You already have access to this item.");
  }

  const users = await prisma.user.findMany({
    where: { email: { in: normalised } },
    select: { id: true, email: true },
  });
  const userIdByEmail = new Map(users.map((user) => [user.email, user.id]));

  await prisma.$transaction(
    normalised.map((email) =>
      prisma.shareGrant.upsert({
        where: { shareId_email: { shareId: share.id, email } },

        update: { revokedAt: null, role, userId: userIdByEmail.get(email) ?? null },
        create: {
          id: newId(),
          shareId: share.id,
          email,
          role,
          userId: userIdByEmail.get(email) ?? null,
        },
      }),
    ),
  );

  const refreshed = await prisma.share.findUniqueOrThrow({
    where: { id: share.id },
    select: shareSelect,
  });
  return toShareDto(refreshed, share.subjectName);
}

export async function revokeShare(context: RequestContext, shareId: string): Promise<void> {
  const share = await prisma.share.findUnique({
    where: { id: shareId },
    select: { id: true, subjectType: true, folderId: true, fileId: true, dataRoomId: true },
  });
  if (!share) throw notFound("This share no longer exists.");

  await resolveSubject(context, {
    type: share.subjectType,
    id:
      share.subjectType === ShareSubjectType.FOLDER
        ? (share.folderId ?? "")
        : share.subjectType === ShareSubjectType.FILE
          ? (share.fileId ?? "")
          : share.dataRoomId,
  });

  await prisma.share.update({ where: { id: shareId }, data: { revokedAt: new Date() } });
}

export async function revokeGrant(context: RequestContext, grantId: string): Promise<void> {
  const grant = await prisma.shareGrant.findUnique({
    where: { id: grantId },
    select: {
      id: true,
      share: {
        select: { subjectType: true, folderId: true, fileId: true, dataRoomId: true },
      },
    },
  });
  if (!grant) throw notFound("This recipient no longer has access.");

  const { share } = grant;
  await resolveSubject(context, {
    type: share.subjectType,
    id:
      share.subjectType === ShareSubjectType.FOLDER
        ? (share.folderId ?? "")
        : share.subjectType === ShareSubjectType.FILE
          ? (share.fileId ?? "")
          : share.dataRoomId,
  });

  await prisma.shareGrant.update({ where: { id: grantId }, data: { revokedAt: new Date() } });
}

export async function listSharedWithMe(
  context: RequestContext,
): Promise<SharedWithMeItemDto[]> {
  const user = context.user;
  if (!user) return [];

  const grants = await prisma.shareGrant.findMany({
    where: {
      email: user.email,
      revokedAt: null,
      share: {
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      role: true,
      createdAt: true,
      share: {
        select: {
          id: true,
          subjectType: true,
          dataRoomId: true,
          folder: { select: { id: true, name: true, parentId: true, deletedAt: true } },
          file: { select: { id: true, name: true, deletedAt: true } },
          dataRoom: {
            select: { id: true, name: true, deletedAt: true, owner: { select: { name: true } } },
          },
        },
      },
    },
  });

  return grants.flatMap((grant): SharedWithMeItemDto[] => {
    const { share } = grant;
    if (share.dataRoom.deletedAt) return [];
    const base = {
      shareId: share.id,
      dataRoomId: share.dataRoomId,
      dataRoomName: share.dataRoom.name,
      ownerName: share.dataRoom.owner.name,
      role: grant.role,
      sharedAt: grant.createdAt.toISOString(),
    };

    if (share.subjectType === ShareSubjectType.FOLDER && share.folder && !share.folder.deletedAt) {
      return [
        {
          ...base,
          subjectType: share.subjectType,
          subjectId: share.folder.id,
          subjectName: share.folder.parentId === null ? share.dataRoom.name : share.folder.name,
          href: `/rooms/${share.dataRoomId}/folders/${share.folder.id}`,
        },
      ];
    }

    if (share.subjectType === ShareSubjectType.FILE && share.file && !share.file.deletedAt) {
      return [
        {
          ...base,
          subjectType: share.subjectType,
          subjectId: share.file.id,
          subjectName: share.file.name,
          href: `/rooms/${share.dataRoomId}/files/${share.file.id}`,
        },
      ];
    }

    if (share.subjectType === ShareSubjectType.DATA_ROOM) {
      return [
        {
          ...base,
          subjectType: share.subjectType,
          subjectId: share.dataRoomId,
          subjectName: share.dataRoom.name,
          href: `/rooms/${share.dataRoomId}`,
        },
      ];
    }

    return [];
  });
}

export interface PublicShareTarget {
  shareId: string;
  subjectType: ShareSubjectType;
  dataRoomId: string;
  dataRoomName: string;
  ownerName: string;
  folderId: string | null;
  fileId: string | null;
  subjectName: string;
}

export async function resolvePublicShare(token: string): Promise<PublicShareTarget> {
  const share = await prisma.share.findFirst({
    where: {
      token,
      mode: ShareMode.PUBLIC_LINK,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      id: true,
      subjectType: true,
      dataRoomId: true,
      folder: { select: { id: true, name: true, parentId: true, deletedAt: true } },
      file: { select: { id: true, name: true, deletedAt: true } },
      dataRoom: { select: { name: true, deletedAt: true, owner: { select: { name: true } } } },
    },
  });

  if (!share) throw notFound("This link is no longer active.");
  if (share.dataRoom.deletedAt || share.folder?.deletedAt || share.file?.deletedAt) {
    throw notFound("This link is no longer active.");
  }

  const rootFolder =
    share.subjectType === ShareSubjectType.DATA_ROOM
      ? await prisma.folder.findFirst({
          where: { dataRoomId: share.dataRoomId, parentId: null },
          select: { id: true },
        })
      : null;

  return {
    shareId: share.id,
    subjectType: share.subjectType,
    dataRoomId: share.dataRoomId,
    dataRoomName: share.dataRoom.name,
    ownerName: share.dataRoom.owner.name,
    folderId: share.folder?.id ?? rootFolder?.id ?? null,
    fileId: share.file?.id ?? null,
    subjectName:
      share.file?.name ??
      (share.folder?.parentId === null ? share.dataRoom.name : share.folder?.name) ??
      share.dataRoom.name,
  };
}
