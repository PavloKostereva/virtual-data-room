"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/keys";
import type { ExplorerItemDto, StarredItemDto } from "@/types/dto";

export function useStarredItems() {
  return useQuery({
    queryKey: queryKeys.starred,
    queryFn: () =>
      apiRequest<{ items: StarredItemDto[] }>("/api/stars").then((data) => data.items),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useToggleStar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (item: ExplorerItemDto) =>
      apiRequest<{ starred: boolean }>("/api/stars", {
        method: "POST",
        body: {
          subjectType: item.kind === "file" ? "FILE" : "FOLDER",
          subjectId: item.id,
        },
      }),
    onMutate: async (item) => {
      const next = !(item.starred ?? false);

      await queryClient.cancelQueries({ queryKey: ["folder"] });
      await queryClient.cancelQueries({ queryKey: queryKeys.starred });

      queryClient.setQueriesData(
        {
          predicate: (query) =>
            query.queryKey[0] === "folder" && query.queryKey[2] === "children",
        },
        (current: unknown) => {
          if (!current || typeof current !== "object" || !("pages" in current)) return current;
          const data = current as {
            pages: Array<{ items: ExplorerItemDto[]; nextCursor: string | null }>;
            pageParams: unknown[];
          };
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((entry) =>
                entry.id === item.id ? { ...entry, starred: next } : entry,
              ),
            })),
          };
        },
      );

      return { next };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.starred });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === "folder" && query.queryKey[2] === "children",
      });
    },
  });
}
