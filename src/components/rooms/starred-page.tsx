"use client";

import { FileText, Folder, Search, Star, X } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ItemIcon } from "@/components/explorer/file-icon";
import {
  COLLECTION_CARD_CLASS,
  COLLECTION_GRID_CLASS,
  COLLECTION_LIST_CLASS,
  COLLECTION_ROW_CLASS,
  LayoutToggle,
} from "@/components/layout/layout-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { useExplorerLayout } from "@/hooks/use-explorer-layout";
import { useStarredItems, useToggleStar } from "@/hooks/use-stars";
import { ApiError } from "@/lib/api-client";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StarredItemDto } from "@/types/dto";

export function StarredPage() {
  const t = useTranslations("starred");
  const te = useTranslations("explorer");
  const tc = useTranslations("common");
  const locale = useLocale();
  const starred = useStarredItems();
  const toggleStar = useToggleStar();
  const { layout, setLayout } = useExplorerLayout();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const items = starred.data ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (entry) =>
        entry.item.name.toLowerCase().includes(needle) ||
        entry.dataRoomName.toLowerCase().includes(needle),
    );
  }, [starred.data, query]);

  const unstar = (entry: StarredItemDto) => {
    toggleStar.mutate(entry.item, {
      onSuccess: () => toast.success(te("unstarredToast", { name: entry.item.name })),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : te("starError")),
    });
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {!starred.isPending && !starred.isError && (starred.data?.length ?? 0) > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 max-w-md">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchAria")}
              className="pl-9 pr-9"
            />
            {query ? (
              <button
                type="button"
                aria-label={tc("clearSearch")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xs p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setQuery("")}
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <LayoutToggle layout={layout} onLayoutChange={setLayout} />
        </div>
      ) : null}

      {starred.isPending ? (
        layout === "grid" ? (
          <div className={COLLECTION_GRID_CLASS}>
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-44 w-[13.5rem] rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        )
      ) : starred.isError ? (
        <ErrorState message={t("loadError")} onRetry={() => void starred.refetch()} />
      ) : (starred.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Star />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          className="border border-dashed border-border"
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Search />}
          title={t("noMatchTitle")}
          description={t("noMatchDescription", { query: query.trim() })}
          action={
            <Button size="sm" variant="secondary" onClick={() => setQuery("")}>
              {tc("clearSearch")}
            </Button>
          }
          className="border border-dashed border-border"
        />
      ) : layout === "grid" ? (
        <ul className={COLLECTION_GRID_CLASS}>
          {filtered.map((entry) => {
            const item = entry.item;
            const Icon = item.kind === "folder" ? Folder : FileText;
            return (
              <li key={entry.starId} className={cn("group", COLLECTION_CARD_CLASS)}>
                <Link href={entry.href} className="flex min-h-0 flex-1 flex-col">
                  <span className="mb-3 flex size-11 items-center justify-center rounded-sm bg-accent text-accent-foreground">
                    {item.kind === "file" ? (
                      <ItemIcon kind="file" mimeType={item.mimeType} className="size-5" />
                    ) : (
                      <Icon className="size-5" aria-hidden />
                    )}
                  </span>
                  <span className="flex min-h-[2.5rem] min-w-0 items-start gap-1 pr-8">
                    <span
                      title={item.name}
                      className="line-clamp-2 break-all text-sm font-medium leading-5 text-foreground"
                    >
                      {item.name}
                    </span>
                  </span>
                  <span className="mt-auto truncate pt-2 text-xs text-muted-foreground">
                    {entry.dataRoomName}
                    {item.kind === "file" ? ` · ${formatBytes(item.size)}` : ""}
                  </span>
                </Link>
                <Button
                  variant="ghost"
                  size="iconSm"
                  aria-label={te("removeStar")}
                  title={te("removeStar")}
                  className="absolute right-3 top-3"
                  isLoading={toggleStar.isPending}
                  onClick={() => unstar(entry)}
                >
                  <Star className="fill-amber-500 text-amber-500" />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className={COLLECTION_LIST_CLASS}>
          {filtered.map((entry) => {
            const item = entry.item;
            const Icon = item.kind === "folder" ? Folder : FileText;
            return (
              <li key={entry.starId} className={cn("group", COLLECTION_ROW_CLASS)}>
                <Link href={entry.href} className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-accent text-accent-foreground">
                    {item.kind === "file" ? (
                      <ItemIcon kind="file" mimeType={item.mimeType} className="size-4" />
                    ) : (
                      <Icon className="size-4" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {entry.dataRoomName}
                      {item.kind === "file" ? ` · ${formatBytes(item.size)}` : ""}
                      {" · "}
                      {tc("updated", { time: formatRelativeTime(entry.starredAt, locale) })}
                    </span>
                  </span>
                  <Badge variant="neutral" className="hidden shrink-0 sm:inline-flex">
                    {item.kind === "folder" ? t("folder") : t("file")}
                  </Badge>
                </Link>
                <Button
                  variant="ghost"
                  size="iconSm"
                  aria-label={te("removeStar")}
                  title={te("removeStar")}
                  isLoading={toggleStar.isPending}
                  onClick={() => unstar(entry)}
                >
                  <Star className="fill-amber-500 text-amber-500" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
