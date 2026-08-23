"use client";

import { Folder, FolderLock, RotateCcw, Search, Trash2, X } from "lucide-react";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { useExplorerLayout } from "@/hooks/use-explorer-layout";
import {
  useEmptyTrash,
  usePermanentlyDeleteTrashItem,
  useRestoreTrashItem,
  useTrashItems,
} from "@/hooks/use-trash";
import { ApiError } from "@/lib/api-client";
import { formatBytes, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TrashedExplorerItemDto, TrashedItemDto } from "@/types/dto";

export function TrashPage() {
  const t = useTranslations("trash");
  const tc = useTranslations("common");
  const locale = useLocale();
  const trash = useTrashItems();
  const restoreItem = useRestoreTrashItem();
  const deleteForever = usePermanentlyDeleteTrashItem();
  const emptyTrash = useEmptyTrash();
  const { layout, setLayout } = useExplorerLayout();
  const [query, setQuery] = useState("");
  const [emptyOpen, setEmptyOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TrashedItemDto | null>(null);

  const filtered = useMemo(() => {
    const items = trash.data ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (entry) =>
        entry.item.name.toLowerCase().includes(needle) ||
        entry.dataRoomName.toLowerCase().includes(needle),
    );
  }, [trash.data, query]);

  const restore = (entry: TrashedItemDto) => {
    restoreItem.mutate(entry.item, {
      onSuccess: () => toast.success(t("restoredToast", { name: entry.item.name })),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : t("restoreError")),
    });
  };

  const confirmDeleteForever = () => {
    if (!deleteTarget) return;
    const name = deleteTarget.item.name;
    deleteForever.mutate(deleteTarget.item, {
      onSuccess: () => {
        setDeleteTarget(null);
        toast.success(t("deletedForeverToast", { name }));
      },
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : t("deleteForeverError")),
    });
  };

  const confirmEmpty = () => {
    emptyTrash.mutate(undefined, {
      onSuccess: () => {
        setEmptyOpen(false);
        toast.success(t("emptiedToast"));
      },
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : t("emptyError")),
    });
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {!trash.isPending && !trash.isError && (trash.data?.length ?? 0) > 0 ? (
          <Button variant="destructive" size="sm" onClick={() => setEmptyOpen(true)}>
            {t("emptyTrash")}
          </Button>
        ) : null}
      </header>

      {!trash.isPending && !trash.isError && (trash.data?.length ?? 0) > 0 ? (
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

      {trash.isPending ? (
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
      ) : trash.isError ? (
        <ErrorState message={t("loadError")} onRetry={() => void trash.refetch()} />
      ) : (trash.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Trash2 />}
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
          {filtered.map((entry) => (
            <TrashCard
              key={`${entry.item.kind}:${entry.item.id}`}
              entry={entry}
              isBusy={restoreItem.isPending || deleteForever.isPending}
              onRestore={() => restore(entry)}
              onDeleteForever={() => setDeleteTarget(entry)}
            />
          ))}
        </ul>
      ) : (
        <ul className={COLLECTION_LIST_CLASS}>
          {filtered.map((entry) => (
            <TrashRow
              key={`${entry.item.kind}:${entry.item.id}`}
              entry={entry}
              locale={locale}
              isBusy={restoreItem.isPending || deleteForever.isPending}
              onRestore={() => restore(entry)}
              onDeleteForever={() => setDeleteTarget(entry)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={emptyOpen}
        onOpenChange={setEmptyOpen}
        title={t("emptyConfirmTitle")}
        description={t("emptyConfirmDescription")}
        confirmLabel={emptyTrash.isPending ? t("emptying") : t("emptyTrash")}
        variant="destructive"
        isLoading={emptyTrash.isPending}
        onConfirm={confirmEmpty}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => (open ? undefined : setDeleteTarget(null))}
        title={t("deleteForeverTitle", { name: deleteTarget?.item.name ?? "" })}
        description={t("deleteForeverDescription")}
        confirmLabel={deleteForever.isPending ? t("deletingForever") : t("deleteForever")}
        variant="destructive"
        isLoading={deleteForever.isPending}
        onConfirm={confirmDeleteForever}
      />
    </div>
  );
}

function trashKindLabel(
  item: TrashedExplorerItemDto,
  t: ReturnType<typeof useTranslations<"trash">>,
) {
  if (item.kind === "dataRoom") return t("dataRoom");
  if (item.kind === "folder") return t("folder");
  return t("file");
}

function TrashItemGlyph({
  item,
  className,
}: {
  item: TrashedExplorerItemDto;
  className?: string;
}) {
  if (item.kind === "file") {
    return <ItemIcon kind="file" mimeType={item.mimeType} className={className} />;
  }
  if (item.kind === "dataRoom") {
    return <FolderLock className={className} aria-hidden />;
  }
  return <Folder className={className} aria-hidden />;
}

function trashSubtitle(entry: TrashedItemDto, t: ReturnType<typeof useTranslations<"trash">>) {
  const item = entry.item;
  if (item.kind === "dataRoom") return t("dataRoom");
  if (item.kind === "file") return `${entry.dataRoomName} · ${formatBytes(item.size)}`;
  return entry.dataRoomName;
}

function TrashCard({
  entry,
  isBusy,
  onRestore,
  onDeleteForever,
}: {
  entry: TrashedItemDto;
  isBusy: boolean;
  onRestore: () => void;
  onDeleteForever: () => void;
}) {
  const t = useTranslations("trash");
  const item = entry.item;

  return (
    <li className={cn("group", COLLECTION_CARD_CLASS)}>
      <span className="mb-3 flex size-11 items-center justify-center rounded-sm bg-accent text-accent-foreground">
        <TrashItemGlyph item={item} className="size-5" />
      </span>
      <span className="flex min-h-[2.5rem] min-w-0 items-start gap-1">
        <span
          title={item.name}
          className="line-clamp-2 break-all text-sm font-medium leading-5 text-foreground"
        >
          {item.name}
        </span>
      </span>
      <span className="mt-auto truncate pt-2 text-xs text-muted-foreground">
        {trashSubtitle(entry, t)}
      </span>
      <span className="mt-1 text-xs text-muted-foreground">
        {t("daysLeft", { count: entry.daysRemaining })}
      </span>
      <div className="mt-3 flex items-center gap-1">
        <Button size="sm" variant="secondary" disabled={isBusy} onClick={onRestore}>
          <RotateCcw />
          {t("restore")}
        </Button>
        <Button
          size="iconSm"
          variant="ghost"
          aria-label={t("deleteForever")}
          title={t("deleteForever")}
          disabled={isBusy}
          onClick={onDeleteForever}
        >
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

function TrashRow({
  entry,
  locale,
  isBusy,
  onRestore,
  onDeleteForever,
}: {
  entry: TrashedItemDto;
  locale: string;
  isBusy: boolean;
  onRestore: () => void;
  onDeleteForever: () => void;
}) {
  const t = useTranslations("trash");
  const tc = useTranslations("common");
  const item = entry.item;

  return (
    <li className={cn("group", COLLECTION_ROW_CLASS)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-accent text-accent-foreground">
        <TrashItemGlyph item={item} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {trashSubtitle(entry, t)}
          {" · "}
          {tc("updated", { time: formatRelativeTime(entry.deletedAt, locale) })}
          {" · "}
          {t("daysLeft", { count: entry.daysRemaining })}
        </span>
      </span>
      <Badge variant="neutral" className="hidden shrink-0 sm:inline-flex">
        {trashKindLabel(item, t)}
      </Badge>
      <Button size="sm" variant="secondary" disabled={isBusy} onClick={onRestore}>
        <RotateCcw />
        {t("restore")}
      </Button>
      <Button
        size="iconSm"
        variant="ghost"
        aria-label={t("deleteForever")}
        title={t("deleteForever")}
        disabled={isBusy}
        onClick={onDeleteForever}
      >
        <Trash2 />
      </Button>
    </li>
  );
}
