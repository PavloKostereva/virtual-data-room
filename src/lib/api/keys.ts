import type { ShareSubjectType } from "@/types/dto";

export const queryKeys = {
  me: ["me"] as const,
  dataRooms: ["data-rooms"] as const,
  dataRoom: (dataRoomId: string) => ["data-room", dataRoomId] as const,
  folderTree: (dataRoomId: string) => ["data-room", dataRoomId, "tree"] as const,
  search: (folderId: string, query: string) => ["folder", folderId, "search", query] as const,
  folder: (folderId: string) => ["folder", folderId] as const,
  folderChildren: (folderId: string, sort: string, direction: string) =>
    ["folder", folderId, "children", sort, direction] as const,
  folderStats: (folderId: string) => ["folder", folderId, "stats"] as const,
  file: (fileId: string) => ["file", fileId] as const,
  shares: (subjectType: ShareSubjectType, subjectId: string) =>
    ["shares", subjectType, subjectId] as const,
  sharedWithMe: ["shared-with-me"] as const,
  starred: ["starred"] as const,
  trash: ["trash"] as const,
};
