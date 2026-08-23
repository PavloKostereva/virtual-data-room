"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/keys";
import type { TrashedExplorerItemDto, TrashedItemDto } from "@/types/dto";

function invalidateAfterTrashChange(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.trash });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dataRooms });
  void queryClient.invalidateQueries({ queryKey: queryKeys.starred });
  void queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === "folder" || query.queryKey[0] === "data-room",
  });
}

export function useTrashItems() {
  return useQuery({
    queryKey: queryKeys.trash,
    queryFn: () =>
      apiRequest<{ items: TrashedItemDto[] }>("/api/trash").then((data) => data.items),
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useRestoreTrashItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (item: TrashedExplorerItemDto) =>
      apiRequest<{ item: TrashedExplorerItemDto }>("/api/trash/restore", {
        method: "POST",
        body: { kind: item.kind, id: item.id },
      }),
    onSuccess: () => invalidateAfterTrashChange(queryClient),
  });
}

export function usePermanentlyDeleteTrashItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (item: TrashedExplorerItemDto) =>
      apiRequest<void>(`/api/trash/${item.kind}/${item.id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAfterTrashChange(queryClient),
  });
}

export function useEmptyTrash() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiRequest<void>("/api/trash/empty", { method: "POST" }),
    onSuccess: () => invalidateAfterTrashChange(queryClient),
  });
}
