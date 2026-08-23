"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { Star } from "lucide-react";
import { ItemActionsMenu } from "@/components/explorer/item-actions-menu";
import { ItemIcon } from "@/components/explorer/file-icon";
import { fileHref, folderHref, useScope } from "@/components/providers/scope-provider";
import { COLLECTION_CARD_CLASS } from "@/components/layout/layout-toggle";
import { Badge } from "@/components/ui/badge";
import {
  clearDraggedItemId,
  hasDraggedItem,
  readDraggedItemId,
  setDraggedItemId,
} from "@/lib/dnd";
import { RelativeTime } from "@/components/ui/relative-time";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ItemRowActions } from "@/components/explorer/item-row";
import type { ExplorerItemDto } from "@/types/dto";

interface ItemCardProps extends ItemRowActions {
  item: ExplorerItemDto;
  canWrite: boolean;
  canShare: boolean;
}

export function ItemCard({
  item,
  canWrite,
  canShare,
  onRename,
  onMove,
  onDelete,
  onShare,
  onPreview,
  onDropItem,
}: ItemCardProps) {
  const scope = useScope();
  const router = useRouter();
  const locale = useLocale();
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const didDragRef = useRef(false);

  const isFolder = item.kind === "folder";
  const href = isFolder ? folderHref(scope, item.id) : fileHref(scope, item.id);

  const open = () => {
    if (isFolder) router.push(href);
    else onPreview(item);
  };

  const handleClick = () => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    open();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    if (!canWrite) return;
    didDragRef.current = true;
    setDraggedItemId(event, item.id);
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    clearDraggedItemId();
    setIsDragging(false);
    setIsDropTarget(false);
    requestAnimationFrame(() => {
      didDragRef.current = false;
    });
  };

  const allowDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!isFolder || !canWrite || !hasDraggedItem(event)) return false;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    setIsDropTarget(true);
    return true;
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    allowDrop(event);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    allowDrop(event);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (next && event.currentTarget.contains(next)) return;
    setIsDropTarget(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!isFolder || !canWrite) return;
    event.preventDefault();
    event.stopPropagation();
    setIsDropTarget(false);
    const draggedId = readDraggedItemId(event);
    clearDraggedItemId();
    if (!draggedId || draggedId === item.id) return;
    onDropItem(draggedId, item.id);
  };

  const stop = (event: MouseEvent) => event.stopPropagation();

  return (
    <div
      role="listitem"
      tabIndex={0}
      draggable={canWrite}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        COLLECTION_CARD_CLASS,
        isDropTarget && "ring-2 ring-primary/40",
        isDragging && "opacity-40",
      )}
    >
      <div className="absolute right-2 top-2" onClick={stop} onDoubleClick={stop}>
        <ItemActionsMenu
          item={item}
          href={href}
          canWrite={canWrite}
          canShare={canShare}
          onOpen={open}
          onRename={() => onRename(item)}
          onMove={() => onMove(item)}
          onDelete={() => onDelete(item)}
          onShare={() => onShare(item)}
          onPreview={() => onPreview(item)}
          triggerClassName="opacity-0 transition-opacity focus-visible:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
        />
      </div>

      <span className="mb-3 flex size-11 shrink-0 items-center justify-center rounded-sm bg-accent text-accent-foreground">
        <ItemIcon
          kind={item.kind}
          mimeType={item.kind === "file" ? item.mimeType : undefined}
          className="size-5"
        />
      </span>
      <span className="flex min-h-[2.5rem] min-w-0 items-start gap-1 pr-5">
        <span
          title={item.name}
          className="line-clamp-2 break-all text-sm font-medium leading-5 text-foreground"
        >
          {item.name}
        </span>
        {item.starred ? (
          <Star className="mt-0.5 size-3.5 shrink-0 fill-amber-500 text-amber-500" aria-hidden />
        ) : null}
      </span>

      <div className="mt-auto truncate text-xs text-muted-foreground">
        <p className="truncate">
          {item.kind === "file" ? formatBytes(item.size) : "—"} ·{" "}
          <RelativeTime value={item.updatedAt} locale={locale} />
        </p>
        {item.kind === "file" && item.versionCount > 1 ? (
          <Badge variant="accent" className="text-[10px]">
            v{item.versionCount}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
