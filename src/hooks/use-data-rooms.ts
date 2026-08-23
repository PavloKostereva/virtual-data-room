"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/keys";
import type { CreateDataRoomInput } from "@/lib/validation";
import type { DataRoomDto, FolderTreeNodeDto, SharedWithMeItemDto } from "@/types/dto";

export function useDataRooms() {
  return useQuery({
    queryKey: queryKeys.dataRooms,
    queryFn: () =>
      apiRequest<{ dataRooms: DataRoomDto[] }>("/api/data-rooms").then((data) => data.dataRooms),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateDataRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateDataRoomInput) =>
      apiRequest<{ dataRoom: DataRoomDto }>("/api/data-rooms", {
        method: "POST",
        body: input,
      }).then((data) => data.dataRoom),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.dataRooms });
      const previous = queryClient.getQueryData<DataRoomDto[]>(queryKeys.dataRooms);
      const optimistic: DataRoomDto = {
        id: `temp-${crypto.randomUUID()}`,
        name: input.name,
        description: input.description ?? null,
        rootFolderId: "",
        role: "OWNER",
        isOwner: true,
        fileCount: 0,
        totalSize: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<DataRoomDto[]>(queryKeys.dataRooms, (current) => [
        optimistic,
        ...(current ?? []),
      ]);
      return { previous, tempId: optimistic.id };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.dataRooms, context.previous);
      }
    },
    onSuccess: (dataRoom, _input, context) => {
      queryClient.setQueryData<DataRoomDto[]>(queryKeys.dataRooms, (current) =>
        (current ?? []).map((room) => (room.id === context?.tempId ? dataRoom : room)),
      );
    },
  });
}

export function useUpdateDataRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      id: string;
      name?: string;
      description?: string | null;
    }) =>
      apiRequest<{ dataRoom: DataRoomDto }>(`/api/data-rooms/${input.id}`, {
        method: "PATCH",
        body: { name: input.name, description: input.description },
      }).then((data) => data.dataRoom),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.dataRooms });
      const previous = queryClient.getQueryData<DataRoomDto[]>(queryKeys.dataRooms);
      queryClient.setQueryData<DataRoomDto[]>(queryKeys.dataRooms, (current) =>
        (current ?? []).map((room) =>
          room.id === input.id
            ? {
                ...room,
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.description !== undefined ? { description: input.description } : {}),
                updatedAt: new Date().toISOString(),
              }
            : room,
        ),
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.dataRooms, context.previous);
      }
    },
    onSuccess: (dataRoom) => {
      queryClient.setQueryData(queryKeys.dataRoom(dataRoom.id), dataRoom);
      queryClient.setQueryData<DataRoomDto[]>(queryKeys.dataRooms, (current) =>
        (current ?? []).map((room) => (room.id === dataRoom.id ? dataRoom : room)),
      );
    },
  });
}

export function useDeleteDataRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dataRoomId: string) =>
      apiRequest<void>(`/api/data-rooms/${dataRoomId}`, { method: "DELETE" }),
    onMutate: async (dataRoomId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.dataRooms });
      const previous = queryClient.getQueryData<DataRoomDto[]>(queryKeys.dataRooms);
      queryClient.setQueryData<DataRoomDto[]>(queryKeys.dataRooms, (current) =>
        (current ?? []).filter((room) => room.id !== dataRoomId),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.dataRooms, context.previous);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trash });
    },
  });
}

export function useFolderTree(dataRoomId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.folderTree(dataRoomId),
    queryFn: () =>
      apiRequest<{ folders: FolderTreeNodeDto[] }>(`/api/data-rooms/${dataRoomId}/tree`).then(
        (data) => data.folders,
      ),
    enabled,
    staleTime: 60_000,
  });
}

export function useSharedWithMe() {
  return useQuery({
    queryKey: queryKeys.sharedWithMe,
    queryFn: () =>
      apiRequest<{ items: SharedWithMeItemDto[] }>("/api/shared-with-me").then(
        (data) => data.items,
      ),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
