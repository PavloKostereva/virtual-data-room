import type { Prisma } from "@prisma/client";
import { badRequest } from "@/server/errors";

export type SortField = "name" | "updatedAt";
export type SortDirection = "asc" | "desc";

export interface ListCursor {
  kind: "folder" | "file";

  value: string;
  id: string;
}

export function encodeCursor(cursor: ListCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | undefined | null): ListCursor | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "kind" in parsed &&
      "value" in parsed &&
      "id" in parsed &&
      (parsed.kind === "folder" || parsed.kind === "file") &&
      typeof parsed.value === "string" &&
      typeof parsed.id === "string"
    ) {
      return { kind: parsed.kind, value: parsed.value, id: parsed.id };
    }
  } catch {
    // fall through
  }
  throw badRequest("Invalid pagination cursor.");
}

export function buildKeysetFilter(
  sort: SortField,
  direction: SortDirection,
  cursor: ListCursor | null,
): Prisma.FolderWhereInput & Prisma.FileWhereInput {
  if (!cursor) return {};

  const operator = direction === "asc" ? "gt" : "lt";
  const boundary = sort === "updatedAt" ? new Date(cursor.value) : cursor.value;

  return {
    OR: [
      { [sort]: { [operator]: boundary } },
      { [sort]: boundary, id: { [operator]: cursor.id } },
    ],
  } as Prisma.FolderWhereInput & Prisma.FileWhereInput;
}

export function buildOrderBy(
  sort: SortField,
  direction: SortDirection,
): Array<Record<string, SortDirection>> {
  return [{ [sort]: direction }, { id: direction }];
}

export function cursorValue(sort: SortField, item: { name: string; updatedAt: Date | string }): string {
  if (sort === "updatedAt") {
    return item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt;
  }
  return item.name;
}

export function compareListedItems(
  a: { id: string; name: string; updatedAt: string },
  b: { id: string; name: string; updatedAt: string },
  sort: SortField,
  direction: SortDirection,
): number {
  const dir = direction === "asc" ? 1 : -1;
  const left = sort === "name" ? a.name : a.updatedAt;
  const right = sort === "name" ? b.name : b.updatedAt;
  if (left < right) return -dir;
  if (left > right) return dir;
  if (a.id < b.id) return -dir;
  if (a.id > b.id) return dir;
  return 0;
}

export function mergeSortedItems<T extends { id: string; name: string; updatedAt: string }>(
  left: readonly T[],
  right: readonly T[],
  sort: SortField,
  direction: SortDirection,
): T[] {
  const merged: T[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const a = left[i];
    const b = right[j];
    if (a && b && compareListedItems(a, b, sort, direction) <= 0) {
      merged.push(a);
      i += 1;
    } else if (b) {
      merged.push(b);
      j += 1;
    }
  }
  while (i < left.length) {
    const item = left[i];
    if (item) merged.push(item);
    i += 1;
  }
  while (j < right.length) {
    const item = right[j];
    if (item) merged.push(item);
    j += 1;
  }
  return merged;
}
