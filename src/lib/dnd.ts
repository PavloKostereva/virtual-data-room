import type { DragEvent } from "react";

export const DATAROOM_ITEM_MIME = "application/x-dataroom-item";

let draggedItemId: string | null = null;

export function dataTransferTypes(event: DragEvent): string[] {
  return Array.from(event.dataTransfer.types);
}

export function hasDataTransferType(event: DragEvent, type: string): boolean {
  return dataTransferTypes(event).includes(type);
}

export function setDraggedItemId(event: DragEvent, itemId: string): void {
  draggedItemId = itemId;
  event.dataTransfer.setData(DATAROOM_ITEM_MIME, itemId);
  event.dataTransfer.setData("text/plain", itemId);
  event.dataTransfer.effectAllowed = "move";
}

export function clearDraggedItemId(): void {
  const current = draggedItemId;
  queueMicrotask(() => {
    if (draggedItemId === current) draggedItemId = null;
  });
}

export function hasDraggedItem(event: DragEvent): boolean {
  if (hasDataTransferType(event, "Files")) return false;
  return Boolean(draggedItemId) || hasDataTransferType(event, DATAROOM_ITEM_MIME) || hasDataTransferType(event, "text/plain");
}

export function readDraggedItemId(event: DragEvent): string {
  return (
    draggedItemId ||
    event.dataTransfer.getData(DATAROOM_ITEM_MIME) ||
    event.dataTransfer.getData("text/plain") ||
    ""
  );
}
