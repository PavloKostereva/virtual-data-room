"use client";

import { FolderOpen, Lock, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { DeleteItemDialog } from "@/components/dialogs/delete-item-dialog";
import { MoveItemDialog } from "@/components/dialogs/move-item-dialog";
import { NameDialog } from "@/components/dialogs/name-dialog";
import { ShareDialog } from "@/components/dialogs/share-dialog";
import { Breadcrumbs } from "@/components/explorer/breadcrumbs";
import { DropZone } from "@/components/explorer/drop-zone";
import { ExplorerToolbar } from "@/components/explorer/explorer-toolbar";
import { ExplorerSkeleton, GridSkeleton, ListSkeleton } from "@/components/explorer/explorer-skeleton";
import { FileViewer } from "@/components/explorer/file-viewer";
import { ItemCard } from "@/components/explorer/item-card";
import { ItemRow } from "@/components/explorer/item-row";
import { COLLECTION_GRID_CLASS } from "@/components/layout/layout-toggle";
import { useScope } from "@/components/providers/scope-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import {
  useCreateFolder,
  useDeleteItem,
  useFolderChildren,
  useFolderView,
  useMoveItem,
  useRenameItem,
  type SortState,
} from "@/hooks/use-explorer";
import { useExplorerLayout } from "@/hooks/use-explorer-layout";
import { useUploads } from "@/hooks/use-uploads";
import { ApiError } from "@/lib/api-client";
import { nextAvailableName } from "@/lib/name";
import type { ExplorerItemDto, FolderViewDto, PageDto, ShareSubjectType } from "@/types/dto";

interface ExplorerScreenProps {
  folderId: string;
  initialView?: FolderViewDto;
  initialChildren?: PageDto<ExplorerItemDto>;
}

interface ShareTarget {
  type: ShareSubjectType;
  id: string;
  name: string;
}

export function ExplorerScreen({
  folderId,
  initialView,
  initialChildren,
}: ExplorerScreenProps) {
  const scope = useScope();
  const { enqueue } = useUploads();
  const t = useTranslations("explorer");
  const tc = useTranslations("common");
  const { layout, setLayout } = useExplorerLayout();

  const [sort, setSort] = useState<SortState>({ field: "name", direction: "asc" });
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ExplorerItemDto | null>(null);
  const [moveTarget, setMoveTarget] = useState<ExplorerItemDto | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExplorerItemDto | null>(null);
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [previewFile, setPreviewFile] = useState<ExplorerItemDto | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const view = useFolderView(folderId, initialView);
  const children = useFolderChildren(folderId, sort, initialChildren);

  const createFolder = useCreateFolder(folderId);
  const renameItem = useRenameItem(folderId);
  const moveItem = useMoveItem(folderId);
  const deleteItem = useDeleteItem(folderId);

  const items = useMemo(
    () => children.data?.pages.flatMap((page) => page.items) ?? [],
    [children.data],
  );

  const access = view.data?.access;
  const canWrite = access?.canWrite ?? false;
  const canShare = access?.canShare ?? false;

  const closeDialogs = useCallback(() => {
    setIsCreatingFolder(false);
    setRenameTarget(null);
    setMoveTarget(null);
    setDeleteTarget(null);
    setDialogError(null);
    setSuggestion(null);
  }, []);

  const handleApiError = useCallback((error: unknown, fallback: string) => {
    if (error instanceof ApiError) {
      setDialogError(error.message);
      setSuggestion(error.suggestedName);
      return;
    }
    setDialogError(fallback);
  }, []);

  const handleUpload = useCallback(
    (files: File[]) => {
      if (!canWrite) return;
      enqueue(files, folderId);
    },
    [canWrite, enqueue, folderId],
  );

  const handleDropItem = useCallback(
    (draggedItemId: string, targetFolderId: string) => {
      if (draggedItemId === targetFolderId) return;
      const dragged = items.find((item) => item.id === draggedItemId);
      if (!dragged) return;

      moveItem.mutate(
        { item: dragged, targetFolderId },
        {
          onSuccess: () => toast.success(t("moveToast", { name: dragged.name })),
          onError: (error) =>
            toast.error(
              error instanceof ApiError ? error.message : t("moveErrorToast", { name: dragged.name }),
            ),
        },
      );
    },
    [items, moveItem, t],
  );

  if (view.isPending) return <ExplorerSkeleton />;

  if (view.isError || children.isError) {
    const error = view.error ?? children.error;
    const isMissing = error instanceof ApiError && (error.status === 404 || error.status === 403);

    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        {isMissing ? (
          <EmptyState
            icon={<Lock />}
            title={t("folderUnavailableTitle")}
            description={t("folderUnavailableDescription")}
            action={
              scope.isPublicView ? null : (
                <Button variant="secondary" size="sm" asChild>
                  <Link href="/rooms">{t("backToRooms")}</Link>
                </Button>
              )
            }
          />
        ) : (
          <ErrorState
            message={error instanceof Error ? error.message : t("folderLoadError")}
            onRetry={() => {
              void view.refetch();
              void children.refetch();
            }}
          />
        )}
      </div>
    );
  }

  const { folder, breadcrumbs, dataRoom } = view.data;
  const existingNames = items.map((item) => item.name);

  const itemActions = {
    onRename: (target: ExplorerItemDto) => {
      setDialogError(null);
      setSuggestion(null);
      setRenameTarget(target);
    },
    onMove: (target: ExplorerItemDto) => {
      setDialogError(null);
      setMoveTarget(target);
    },
    onDelete: setDeleteTarget,
    onShare: (target: ExplorerItemDto) =>
      setShareTarget({
        type: target.kind === "folder" ? "FOLDER" : "FILE",
        id: target.id,
        name: target.name,
      }),
    onPreview: setPreviewFile,
    onDropItem: handleDropItem,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Breadcrumbs items={breadcrumbs} />
          {scope.isPublicView ? <Badge variant="accent">{tc("readOnly")}</Badge> : null}
        </div>

        <ExplorerToolbar
          canWrite={canWrite}
          canShare={canShare}
          sort={sort}
          layout={layout}
          onLayoutChange={setLayout}
          onSortChange={setSort}
          onCreateFolder={() => {
            setDialogError(null);
            setIsCreatingFolder(true);
          }}
          onFilesSelected={handleUpload}
          onShare={() =>
            setShareTarget({
              type: folder.parentId === null ? "DATA_ROOM" : "FOLDER",
              id: folder.parentId === null ? dataRoom.id : folder.id,
              name: folder.parentId === null ? dataRoom.name : folder.name,
            })
          }
        />
      </header>

      <DropZone
        disabled={!canWrite}
        onFiles={handleUpload}
        className="flex min-h-0 flex-1 flex-col px-2 py-2 sm:px-4"
      >
        {children.isPending ? (
          layout === "grid" ? <GridSkeleton /> : <ListSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            icon={canWrite ? <UploadCloud /> : <FolderOpen />}
            title={canWrite ? t("folderEmptyTitle") : t("folderEmptyReadOnlyTitle")}
            description={
              canWrite ? t("folderEmptyDescription") : t("folderEmptyReadOnlyDescription")
            }
            action={
              canWrite ? (
                <Button variant="secondary" size="sm" onClick={() => setIsCreatingFolder(true)}>
                  {t("createFolderAction")}
                </Button>
              ) : null
            }
          />
        ) : layout === "grid" ? (
          <>
            <div
              role="list"
              aria-label={t("folderContents")}
              className={COLLECTION_GRID_CLASS}
            >
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  canWrite={canWrite}
                  canShare={canShare}
                  {...itemActions}
                />
              ))}
            </div>

            {children.hasNextPage ? (
              <div className="flex justify-center py-4">
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={children.isFetchingNextPage}
                  onClick={() => void children.fetchNextPage()}
                >
                  {t("loadMore")}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div role="table" aria-label={t("folderContents")} className="min-h-0 flex-1">
              <div
                role="row"
                className="hidden grid-cols-[minmax(0,1fr)_7rem_9rem_2.25rem] gap-3 px-3 pb-2 pt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid"
              >
                <span role="columnheader">{t("columnName")}</span>
                <span role="columnheader">{t("columnSize")}</span>
                <span role="columnheader">{t("columnModified")}</span>
                <span role="columnheader" className="sr-only">
                  {tc("actions")}
                </span>
              </div>

              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  canWrite={canWrite}
                  canShare={canShare}
                  {...itemActions}
                />
              ))}
            </div>

            {children.hasNextPage ? (
              <div className="flex justify-center py-4">
                <Button
                  variant="secondary"
                  size="sm"
                  isLoading={children.isFetchingNextPage}
                  onClick={() => void children.fetchNextPage()}
                >
                  {t("loadMore")}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </DropZone>

      <NameDialog
        open={isCreatingFolder}
        onOpenChange={(open) => (open ? setIsCreatingFolder(true) : closeDialogs())}
        title={t("newFolder")}
        label={t("folderName")}
        initialValue={nextAvailableName(t("untitledFolder"), existingNames)}
        submitLabel={tc("create")}
        isSubmitting={createFolder.isPending}
        error={dialogError}
        suggestion={suggestion}
        onSubmit={(name) =>
          createFolder.mutate(name, {
            onSuccess: () => {
              closeDialogs();
              toast.success(t("createdFolderToast", { name }));
            },
            onError: (error) => handleApiError(error, t("folderCreateError")),
          })
        }
      />

      <NameDialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => (open ? undefined : closeDialogs())}
        title={renameTarget?.kind === "folder" ? t("renameFolder") : t("renameFile")}
        label={tc("name")}
        initialValue={renameTarget?.name ?? ""}
        submitLabel={tc("save")}
        isSubmitting={renameItem.isPending}
        error={dialogError}
        suggestion={suggestion}
        onSubmit={(name) => {
          if (!renameTarget) return;
          renameItem.mutate(
            { item: renameTarget, name },
            {
              onSuccess: () => {
                closeDialogs();
                toast.success(t("renamedToast"));
              },
              onError: (error) => handleApiError(error, t("renameError")),
            },
          );
        }}
      />

      <MoveItemDialog
        item={moveTarget}
        dataRoomId={dataRoom.id}
        currentFolderId={folderId}
        isMoving={moveItem.isPending}
        error={dialogError}
        onOpenChange={(open) => (open ? undefined : closeDialogs())}
        onMove={(targetFolderId) => {
          if (!moveTarget) return;
          moveItem.mutate(
            { item: moveTarget, targetFolderId },
            {
              onSuccess: () => {
                const name = moveTarget.name;
                closeDialogs();
                toast.success(t("moveToast", { name }));
              },
              onError: (error) => handleApiError(error, t("moveError")),
            },
          );
        }}
      />

      <DeleteItemDialog
        item={deleteTarget}
        isDeleting={deleteItem.isPending}
        onOpenChange={(open) => (open ? undefined : closeDialogs())}
        onConfirm={() => {
          if (!deleteTarget) return;
          const name = deleteTarget.name;
          deleteItem.mutate(deleteTarget, {
            onSuccess: () => {
              closeDialogs();
              toast.success(t("deletedItemToast", { name }));
            },
            onError: (error) =>
              toast.error(
                error instanceof ApiError ? error.message : t("deleteItemErrorToast", { name }),
              ),
          });
        }}
      />

      <ShareDialog subject={shareTarget} onOpenChange={(open) => !open && setShareTarget(null)} />

      <FileViewer
        file={previewFile?.kind === "file" ? previewFile : null}
        onOpenChange={(open) => !open && setPreviewFile(null)}
      />
    </div>
  );
}
