"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useScope } from "@/components/providers/scope-provider";
import { apiRequest, withQuery } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/keys";
import type {
  ExplorerItemDto,
  FileDetailDto,
  FileDto,
  FolderDto,
  FolderStatsDto,
  FolderViewDto,
  PageDto,
  SearchResultDto,
} from "@/types/dto";

export type SortField = "name" | "updatedAt";
export type SortDirection = "asc" | "desc";

export interface SortState {
  field: SortField;
  direction: SortDirection;
}

const PAGE_SIZE = 50;

type ChildrenData = InfiniteData<PageDto<ExplorerItemDto>, string | undefined>;

function childrenQueryFilter(folderId: string) {
  return {
    predicate: (query: { queryKey: readonly unknown[] }) => {
      const key = query.queryKey;
      return key[0] === "folder" && key[1] === folderId && key[2] === "children";
    },
  };
}

function mapChildren(
  queryClient: QueryClient,
  folderId: string,
  mapItems: (items: ExplorerItemDto[]) => ExplorerItemDto[],
) {
  queryClient.setQueriesData<ChildrenData>(childrenQueryFilter(folderId), (current) => {
    if (!current) return current;
    return {
      ...current,
      pages: current.pages.map((page) => ({
        ...page,
        items: mapItems(page.items),
      })),
    };
  });
}

function upsertChild(
  queryClient: QueryClient,
  folderId: string,
  item: ExplorerItemDto,
) {
  const matching = queryClient.getQueriesData<ChildrenData>(childrenQueryFilter(folderId));
  if (matching.length === 0) {
    queryClient.setQueryData<ChildrenData>(queryKeys.folderChildren(folderId, "name", "asc"), {
      pages: [{ items: [item], nextCursor: null }],
      pageParams: [undefined],
    });
    return;
  }

  mapChildren(queryClient, folderId, (items) => {
    const without = items.filter((entry) => entry.id !== item.id);
    return [item, ...without];
  });
}

function refreshFolder(queryClient: QueryClient, folderId: string) {
  void queryClient.invalidateQueries({
    queryKey: ["folder", folderId],
    refetchType: "all",
  });
}

const LIVENESS_OPTIONS = {
  staleTime: 60_000,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
} as const;

export function useFolderView(folderId: string, initialData?: FolderViewDto) {
  const { shareToken } = useScope();

  return useQuery({
    queryKey: queryKeys.folder(folderId),
    queryFn: () => apiRequest<FolderViewDto>(`/api/folders/${folderId}`, { shareToken }),
    initialData,
    ...LIVENESS_OPTIONS,
  });
}

export function useFolderChildren(
  folderId: string,
  sort: SortState,
  initialData?: PageDto<ExplorerItemDto>,
) {
  const { shareToken } = useScope();
  const isDefaultSort = sort.field === "name" && sort.direction === "asc";

  return useInfiniteQuery({
    queryKey: queryKeys.folderChildren(folderId, sort.field, sort.direction),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiRequest<PageDto<ExplorerItemDto>>(
        withQuery(`/api/folders/${folderId}/children`, {
          sort: sort.field,
          direction: sort.direction,
          limit: PAGE_SIZE,
          cursor: pageParam,
        }),
        { shareToken },
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData:
      initialData && isDefaultSort
        ? { pages: [initialData], pageParams: [undefined] }
        : undefined,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
}

export function useFileDetail(fileId: string | null) {
  const { shareToken } = useScope();

  return useQuery({
    queryKey: queryKeys.file(fileId ?? "none"),
    queryFn: () =>
      apiRequest<{ file: FileDetailDto }>(`/api/files/${fileId}`, { shareToken }).then(
        (data) => data.file,
      ),
    enabled: Boolean(fileId),
    staleTime: 60_000,
  });
}

export function useFolderStats(folderId: string | null) {
  const { shareToken } = useScope();

  return useQuery({
    queryKey: queryKeys.folderStats(folderId ?? "none"),
    queryFn: () =>
      apiRequest<FolderStatsDto>(`/api/folders/${folderId}/stats`, { shareToken }),
    enabled: Boolean(folderId),
    staleTime: 60_000,
  });
}

export function useCreateFolder(parentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) =>
      apiRequest<{ folder: FolderDto }>("/api/folders", {
        method: "POST",
        body: { parentId, name },
      }).then((data) => data.folder),
    onMutate: async (name) => {
      await queryClient.cancelQueries(childrenQueryFilter(parentId));
      const previous = queryClient.getQueriesData<ChildrenData>(childrenQueryFilter(parentId));

      const optimistic: FolderDto = {
        kind: "folder",
        id: `temp-${crypto.randomUUID()}`,
        name,
        parentId,
        dataRoomId: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mapChildren(queryClient, parentId, (items) => [optimistic, ...items]);
      return { previous, tempId: optimistic.id };
    },
    onError: (_error, _name, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: (folder, _name, context) => {
      mapChildren(queryClient, parentId, (items) =>
        items.map((item) => (item.id === context?.tempId ? folder : item)),
      );
    },
  });
}

export function useRenameItem(currentFolderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      item: ExplorerItemDto;
      name: string;
      conflictStrategy?: "fail" | "rename";
    }): Promise<ExplorerItemDto> =>
      input.item.kind === "folder"
        ? apiRequest<{ folder: FolderDto }>(`/api/folders/${input.item.id}`, {
            method: "PATCH",
            body: { name: input.name },
          }).then((data) => data.folder)
        : apiRequest<{ file: FileDto }>(`/api/files/${input.item.id}`, {
            method: "PATCH",
            body: { name: input.name, conflictStrategy: input.conflictStrategy ?? "fail" },
          }).then((data) => data.file),
    onMutate: async (input) => {
      await queryClient.cancelQueries(childrenQueryFilter(currentFolderId));
      const previous = queryClient.getQueriesData<ChildrenData>(
        childrenQueryFilter(currentFolderId),
      );
      mapChildren(queryClient, currentFolderId, (items) =>
        items.map((item) =>
          item.id === input.item.id ? { ...item, name: input.name } : item,
        ),
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: (result, input) => {
      const renamed: ExplorerItemDto = {
        ...input.item,
        ...result,
        starred: input.item.starred,
      };
      mapChildren(queryClient, currentFolderId, (items) =>
        items.map((item) => (item.id === input.item.id ? renamed : item)),
      );
      void queryClient.invalidateQueries({
        queryKey: ["file", input.item.id],
        refetchType: "none",
      });
      if (input.item.starred) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.starred });
      }
    },
  });
}

export function useMoveItem(currentFolderId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (input: {
      item: ExplorerItemDto;
      targetFolderId: string;
      conflictStrategy?: "fail" | "rename";
    }): Promise<ExplorerItemDto> =>
      input.item.kind === "folder"
        ? apiRequest<{ folder: FolderDto }>(`/api/folders/${input.item.id}`, {
            method: "PATCH",
            body: { parentId: input.targetFolderId },
          }).then((data) => data.folder)
        : apiRequest<{ file: FileDto }>(`/api/files/${input.item.id}`, {
            method: "PATCH",
            body: {
              folderId: input.targetFolderId,
              conflictStrategy: input.conflictStrategy ?? "fail",
            },
          }).then((data) => data.file),
    onMutate: async (input) => {
      await Promise.all([
        queryClient.cancelQueries(childrenQueryFilter(currentFolderId)),
        queryClient.cancelQueries(childrenQueryFilter(input.targetFolderId)),
      ]);

      const previousSource = queryClient.getQueriesData<ChildrenData>(
        childrenQueryFilter(currentFolderId),
      );
      const previousTarget = queryClient.getQueriesData<ChildrenData>(
        childrenQueryFilter(input.targetFolderId),
      );

      const moved: ExplorerItemDto =
        input.item.kind === "folder"
          ? { ...input.item, parentId: input.targetFolderId }
          : { ...input.item, folderId: input.targetFolderId };

      mapChildren(queryClient, currentFolderId, (items) =>
        items.filter((item) => item.id !== input.item.id),
      );
      upsertChild(queryClient, input.targetFolderId, moved);

      return { previousSource, previousTarget };
    },
    onError: (_error, input, context) => {
      context?.previousSource.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      context?.previousTarget.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      if (context?.previousTarget.length === 0) {
        queryClient.removeQueries({
          queryKey: queryKeys.folderChildren(input.targetFolderId, "name", "asc"),
        });
      }
    },
    onSuccess: async (result, input) => {
      const moved: ExplorerItemDto = {
        ...input.item,
        ...result,
        starred: input.item.starred,
      };
      await Promise.all([
        queryClient.cancelQueries(childrenQueryFilter(currentFolderId)),
        queryClient.cancelQueries(childrenQueryFilter(input.targetFolderId)),
      ]);
      mapChildren(queryClient, currentFolderId, (items) =>
        items.filter((item) => item.id !== input.item.id),
      );
      upsertChild(queryClient, input.targetFolderId, moved);
      refreshFolder(queryClient, currentFolderId);
      refreshFolder(queryClient, input.targetFolderId);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.folderTree(input.item.dataRoomId),
        refetchType: "all",
      });
      router.refresh();
    },
  });
}

export function useDeleteItem(currentFolderId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (item: ExplorerItemDto) =>
      apiRequest<void>(
        item.kind === "folder" ? `/api/folders/${item.id}` : `/api/files/${item.id}`,
        { method: "DELETE" },
      ),
    onMutate: async (item) => {
      await queryClient.cancelQueries(childrenQueryFilter(currentFolderId));
      const previous = queryClient.getQueriesData<ChildrenData>(
        childrenQueryFilter(currentFolderId),
      );
      mapChildren(queryClient, currentFolderId, (items) =>
        items.filter((entry) => entry.id !== item.id),
      );
      return { previous };
    },
    onError: (_error, _item, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.dataRooms,
        refetchType: "active",
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.trash });
    },
  });
}

export function useSearch(scopeFolderId: string, query: string) {
  const { shareToken } = useScope();
  const trimmed = query.trim();

  return useQuery({
    queryKey: queryKeys.search(scopeFolderId, trimmed),
    queryFn: () =>
      apiRequest<{ results: SearchResultDto[] }>(
        withQuery(`/api/folders/${scopeFolderId}/search`, { q: trimmed }),
        { shareToken },
      ).then((data) => data.results),
    enabled: trimmed.length >= 2,
    staleTime: 15_000,
  });
}
