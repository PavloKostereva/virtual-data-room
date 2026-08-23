"use client";

import { COLLECTION_GRID_CLASS } from "@/components/layout/layout-toggle";
import { Skeleton } from "@/components/ui/feedback";
import { useExplorerLayout } from "@/hooks/use-explorer-layout";

export function ExplorerPageSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy aria-live="polite">
      <div className="flex h-[3.75rem] shrink-0 items-center gap-3 border-b border-border px-4 sm:px-6">
        <Skeleton className="size-8 rounded-sm" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="ml-auto hidden h-9 w-72 sm:block" />
      </div>
      <ExplorerSkeleton />
    </div>
  );
}

export function ExplorerSkeleton() {
  const { layout } = useExplorerLayout();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <Skeleton className="h-5 w-28" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
      <div className="px-2 py-2 sm:px-4">
        {layout === "grid" ? <GridSkeleton /> : <ListSkeleton />}
      </div>
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className={COLLECTION_GRID_CLASS} aria-busy>
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <Skeleton key={index} className="h-44 w-[13.5rem] rounded-lg" />
      ))}
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="space-y-1" aria-busy>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
        <div key={index} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="size-5 rounded-xs" />
          <Skeleton className="h-4 max-w-72 flex-1" />
          <Skeleton className="hidden h-4 w-16 sm:block" />
          <Skeleton className="hidden h-4 w-24 sm:block" />
        </div>
      ))}
    </div>
  );
}
