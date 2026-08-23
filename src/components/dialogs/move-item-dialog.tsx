"use client";

import { ChevronRight, Folder, FolderOpen, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { useFolderTree } from "@/hooks/use-data-rooms";
import { cn } from "@/lib/utils";
import type { ExplorerItemDto, FolderTreeNodeDto } from "@/types/dto";

interface MoveItemDialogProps {
  item: ExplorerItemDto | null;
  dataRoomId: string;
  currentFolderId: string;
  isMoving: boolean;
  error?: string | null;
  onOpenChange: (open: boolean) => void;
  onMove: (targetFolderId: string) => void;
}

interface TreeNode extends FolderTreeNodeDto {
  children: TreeNode[];
  depth: number;
}

export function MoveItemDialog({
  item,
  dataRoomId,
  currentFolderId,
  isMoving,
  error,
  onOpenChange,
  onMove,
}: MoveItemDialogProps) {
  const open = Boolean(item);
  const tree = useFolderTree(dataRoomId, open);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const nodes = useMemo(() => buildTree(tree.data ?? []), [tree.data]);


  const disabledIds = useMemo(() => {
    const disabled = new Set<string>([currentFolderId]);
    if (item?.kind === "folder") {
      disabled.add(item.id);
      for (const descendant of collectDescendants(nodes, item.id)) disabled.add(descendant);
    }
    return disabled;
  }, [currentFolderId, item, nodes]);

  const visibleRows = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (query.length > 0) {
      return (tree.data ?? [])
        .filter((folder) => folder.name.toLowerCase().includes(query))
        .map((folder) => ({ ...folder, children: [], depth: 0 }) as TreeNode);
    }
    return flatten(nodes, expanded);
  }, [filter, nodes, tree.data, expanded]);

  const toggle = (folderId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader
          title={`Move “${item?.name ?? ""}”`}
          description="Choose the folder to move this item into."
        />

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Search folders"
            className="pl-8"
            aria-label="Search folders"
          />
        </div>

        <div className="scrollbar-thin mt-3 h-64 overflow-y-auto rounded-sm border border-border p-1">
          {tree.isPending ? (
            <div className="space-y-1.5 p-2">
              {[0, 1, 2, 3, 4].map((index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          ) : tree.isError ? (
            <ErrorState
              message="Folders could not be loaded."
              onRetry={() => void tree.refetch()}
              className="py-8"
            />
          ) : visibleRows.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No folders match.</p>
          ) : (
            <ul role="tree" aria-label="Folders">
              {visibleRows.map((node) => {
                const isDisabled = disabledIds.has(node.id);
                const isSelected = selectedId === node.id;

                return (
                  <li key={node.id} role="treeitem" aria-selected={isSelected}>
                    <div
                      className={cn(
                        "flex items-center gap-1 rounded-xs",
                        isSelected && "bg-accent",
                      )}
                      style={{ paddingLeft: `${node.depth * 1.15}rem` }}
                    >
                      {node.hasChildren && filter.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => toggle(node.id)}
                          aria-label={expanded.has(node.id) ? "Collapse" : "Expand"}
                          className="rounded-xs p-1 text-muted-foreground hover:bg-muted"
                        >
                          <ChevronRight
                            className={cn(
                              "size-3.5 transition-transform",
                              expanded.has(node.id) && "rotate-90",
                            )}
                          />
                        </button>
                      ) : (
                        <span className="w-[1.4rem]" />
                      )}

                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setSelectedId(node.id)}
                        onDoubleClick={() => !isDisabled && onMove(node.id)}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 rounded-xs px-1.5 py-1.5 text-left text-sm transition-colors",
                          isDisabled
                            ? "cursor-not-allowed text-muted-foreground/50"
                            : "hover:bg-muted",
                          isSelected && "font-medium text-accent-foreground",
                        )}
                        title={isDisabled ? "This item is already here or is inside it" : undefined}
                      >
                        {isSelected ? (
                          <FolderOpen className="size-4 shrink-0 text-primary" />
                        ) : (
                          <Folder className="size-4 shrink-0 text-primary/70" />
                        )}
                        <span className="truncate">{node.name}</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error ? (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selectedId || disabledIds.has(selectedId)}
            isLoading={isMoving}
            onClick={() => selectedId && onMove(selectedId)}
          >
            Move here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildTree(folders: FolderTreeNodeDto[]): TreeNode[] {
  const byId = new Map<string, TreeNode>(
    folders.map((folder) => [folder.id, { ...folder, children: [], depth: 0 }]),
  );
  const roots: TreeNode[] = [];

  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) {
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function flatten(nodes: TreeNode[], expanded: Set<string>, depth = 0): TreeNode[] {
  return nodes.flatMap((node) => {
    const self = { ...node, depth };

    const isOpen = depth === 0 || expanded.has(node.id);
    return isOpen ? [self, ...flatten(node.children, expanded, depth + 1)] : [self];
  });
}

function collectDescendants(nodes: TreeNode[], folderId: string): string[] {
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    if (node.id === folderId) {
      const descendants: string[] = [];
      const inner = [...node.children];
      while (inner.length > 0) {
        const child = inner.pop();
        if (!child) continue;
        descendants.push(child.id);
        inner.push(...child.children);
      }
      return descendants;
    }
    stack.push(...node.children);
  }
  return [];
}
