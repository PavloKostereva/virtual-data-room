"use client";

import { FileText, Folder, FolderLock, Inbox, Search, X } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
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
import { useSharedWithMe } from "@/hooks/use-data-rooms";
import { useExplorerLayout } from "@/hooks/use-explorer-layout";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ShareSubjectType } from "@/types/dto";

const SUBJECT_ICON: Record<ShareSubjectType, typeof Folder> = {
  DATA_ROOM: FolderLock,
  FOLDER: Folder,
  FILE: FileText,
};

const SUBJECT_LABEL_KEYS = {
  DATA_ROOM: "dataRoom",
  FOLDER: "folder",
  FILE: "file",
} as const;

export function SharedWithMePage() {
  const t = useTranslations("shared");
  const tc = useTranslations("common");
  const locale = useLocale();
  const shared = useSharedWithMe();
  const { layout, setLayout } = useExplorerLayout();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const items = shared.data ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (item) =>
        item.subjectName.toLowerCase().includes(needle) ||
        item.dataRoomName.toLowerCase().includes(needle) ||
        item.ownerName.toLowerCase().includes(needle),
    );
  }, [shared.data, query]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      {!shared.isPending && !shared.isError && (shared.data?.length ?? 0) > 0 ? (
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

      {shared.isPending ? (
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
      ) : shared.isError ? (
        <ErrorState message={t("loadError")} onRetry={() => void shared.refetch()} />
      ) : shared.data.length === 0 ? (
        <EmptyState
          icon={<Inbox />}
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
          {filtered.map((item) => {
            const Icon = SUBJECT_ICON[item.subjectType];
            return (
              <li key={item.shareId}>
                <Link href={item.href} className={cn("group", COLLECTION_CARD_CLASS)}>
                  <span className="mb-3 flex size-11 items-center justify-center rounded-sm bg-accent text-accent-foreground">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span
                    title={item.subjectName}
                    className="line-clamp-2 min-h-[2.5rem] break-all text-sm font-medium leading-5 text-foreground"
                  >
                    {item.subjectName}
                  </span>
                  <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {t(SUBJECT_LABEL_KEYS[item.subjectType])} · {item.ownerName}
                  </span>
                  <span className="mt-auto flex items-center justify-between gap-2 pt-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {formatRelativeTime(item.sharedAt, locale)}
                    </span>
                    <Badge>{item.role === "VIEWER" ? t("viewer") : t("editor")}</Badge>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className={COLLECTION_LIST_CLASS}>
          {filtered.map((item) => {
            const Icon = SUBJECT_ICON[item.subjectType];
            return (
              <li key={item.shareId}>
                <Link href={item.href} className={COLLECTION_ROW_CLASS}>
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-accent text-accent-foreground">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {item.subjectName}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {t(SUBJECT_LABEL_KEYS[item.subjectType])} · {item.ownerName} ·{" "}
                      {formatRelativeTime(item.sharedAt, locale)}
                    </span>
                  </span>
                  <Badge>{item.role === "VIEWER" ? t("viewer") : t("editor")}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
