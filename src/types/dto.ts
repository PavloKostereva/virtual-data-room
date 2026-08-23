import type { Role, ShareMode, ShareSubjectType } from "@prisma/client";

export type { Role, ShareMode, ShareSubjectType };

export interface UserDto {
  id: string;
  email: string;
  name: string;
}

export interface DataRoomDto {
  id: string;
  name: string;
  description: string | null;
  rootFolderId: string;
  role: Role;
  isOwner: boolean;
  fileCount: number;
  totalSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface BreadcrumbDto {
  id: string;
  name: string;
}

export interface FolderDto {
  kind: "folder";
  id: string;
  name: string;
  parentId: string | null;
  dataRoomId: string;
  createdAt: string;
  updatedAt: string;
  starred?: boolean;
}

export interface FileDto {
  kind: "file";
  id: string;
  name: string;
  folderId: string;
  dataRoomId: string;
  mimeType: string;
  size: number;
  versionCount: number;
  createdAt: string;
  updatedAt: string;
  starred?: boolean;
}

export interface DataRoomItemDto {
  kind: "dataRoom";
  id: string;
  name: string;
  description: string | null;
}

export type ExplorerItemDto = FolderDto | FileDto;
export type TrashedExplorerItemDto = ExplorerItemDto | DataRoomItemDto;

export interface AccessDto {
  role: Role;
  isOwner: boolean;
  canWrite: boolean;
  canShare: boolean;

  boundaryFolderId: string | null;
}

export interface FolderViewDto {
  dataRoom: { id: string; name: string };
  folder: FolderDto;
  breadcrumbs: BreadcrumbDto[];
  access: AccessDto;
}

export interface PageDto<T> {
  items: T[];
  nextCursor: string | null;
}

export interface FolderStatsDto {
  folderCount: number;
  fileCount: number;
  totalSize: number;
}

export interface FileVersionDto {
  id: string;
  versionNumber: number;
  size: number;
  createdAt: string;
  isCurrent: boolean;
  uploadedBy: string | null;
}

export interface FileDetailDto extends FileDto {
  versions: FileVersionDto[];
  access: AccessDto;
  dataRoom: { id: string; name: string };
  breadcrumbs: BreadcrumbDto[];
}

export interface UploadTicketDto {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  storageKey: string;
  expiresAt: string;
}

export interface ShareGrantDto {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface ShareDto {
  id: string;
  mode: ShareMode;
  role: Role;
  subjectType: ShareSubjectType;
  subjectId: string;
  subjectName: string;

  url: string | null;
  expiresAt: string | null;
  createdAt: string;
  grants: ShareGrantDto[];
}

export interface SharedWithMeItemDto {
  shareId: string;
  subjectType: ShareSubjectType;
  subjectId: string;
  subjectName: string;
  dataRoomId: string;
  dataRoomName: string;
  ownerName: string;
  role: Role;
  sharedAt: string;

  href: string;
}

export interface StarredItemDto {
  starId: string;
  starredAt: string;
  dataRoomId: string;
  dataRoomName: string;
  href: string;
  item: ExplorerItemDto;
}

export interface TrashedItemDto {
  item: TrashedExplorerItemDto;
  deletedAt: string;
  daysRemaining: number;
  dataRoomId: string;
  dataRoomName: string;
}

export interface SearchResultDto {
  item: ExplorerItemDto;

  location: string[];
  locationFolderId: string;
}

export interface FolderTreeNodeDto {
  id: string;
  name: string;
  parentId: string | null;
  hasChildren: boolean;
}
