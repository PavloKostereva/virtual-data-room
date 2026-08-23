"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import { Star } from "lucide-react";
import { ItemActionsMenu } from "@/components/explorer/item-actions-menu";
import { ItemIcon } from "@/components/explorer/file-icon";
import { fileHref, folderHref, useScope } from "@/components/providers/scope-provider";
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
import type { ExplorerItemDto } from "@/types/dto";

export interface ItemRowActions {
  onRename: (item: ExplorerItemDto) => void;
  onMove: (item: ExplorerItemDto) => void;
  onDelete: (item: ExplorerItemDto) => void;
  onShare: (item: ExplorerItemDto) => void;
  onPreview: (item: ExplorerItemDto) => void;
  onDropItem: (draggedItemId: string, targetFolderId: string) => void;
}

interface ItemRowProps extends ItemRowActions {
  item: ExplorerItemDto;
  canWrite: boolean;
  canShare: boolean;
}

export function ItemRow({
  item,
  canWrite,
  canShare,
  onRename,
  onMove,
  onDelete,
  onShare,
  onPreview,
  onDropItem,
}: ItemRowProps) {
  const scope = useScope();
  const router = useRouter();
  const locale = useLocale();
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const didDragRef = useRef(false);

  const isFolder = item.kind === "folder";
  const href = isFolder ? folderHref(scope, item.id) : fileHref(scope, item.id);

  const open = () => {
    if (isFolder) {
      router.push(href);
    } else {
      onPreview(item);
    }
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

    const ghost = document.createElement("div");
    ghost.textContent = item.name;
    Object.assign(ghost.style, {
      position: "fixed",
      top: "-1000px",
      left: "-1000px",
      maxWidth: "16rem",
      padding: "0.5rem 0.75rem",
      borderRadius: "0.375rem",
      border: "1px solid var(--border)",
      background: "var(--card)",
      color: "var(--foreground)",
      boxShadow: "0 8px 24px color-mix(in oklab, var(--foreground) 12%, transparent)",
      font: "500 13px/1.25 ui-sans-serif, system-ui, sans-serif",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      pointerEvents: "none",
      zIndex: "9999",
    });
    document.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 12, 12);
    requestAnimationFrame(() => ghost.remove());
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
      role="row"
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
        "group grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-sm px-3 py-2.5 transition-colors",
        "hover:bg-muted focus-visible:bg-muted sm:grid-cols-[minmax(0,1fr)_7rem_9rem_2.25rem]",
        isDropTarget && "bg-accent ring-2 ring-primary/40",
        isDragging && "opacity-40",
      )}
    >
      <div role="cell" className="flex min-w-0 items-center gap-3">
        <ItemIcon kind={item.kind} mimeType={item.kind === "file" ? item.mimeType : undefined} />
        <span className="min-w-0 truncate text-sm font-medium text-foreground">{item.name}</span>
        {item.starred ? (
          <Star className="size-3.5 shrink-0 fill-amber-500 text-amber-500" aria-hidden />
        ) : null}
        {item.kind === "file" && item.versionCount > 1 ? (
          <Badge variant="accent" title={`${item.versionCount} versions`}>
            v{item.versionCount}
          </Badge>
        ) : null}
      </div>

      <div role="cell" className="hidden text-sm tabular-nums text-muted-foreground sm:block">
        {item.kind === "file" ? formatBytes(item.size) : "—"}
      </div>

      <div role="cell" className="hidden truncate text-sm text-muted-foreground sm:block">
        <RelativeTime value={item.updatedAt} locale={locale} />
      </div>

      <div role="cell" onClick={stop} onDoubleClick={stop}>
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
    </div>
  );
}
