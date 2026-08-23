"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/feedback";
import { useFolderStats } from "@/hooks/use-explorer";
import { formatBytes, formatCount } from "@/lib/format";
import type { ExplorerItemDto } from "@/types/dto";

interface DeleteItemDialogProps {
  item: ExplorerItemDto | null;
  onOpenChange: (open: boolean) => void;
  isDeleting: boolean;
  onConfirm: () => void;
}

export function DeleteItemDialog({
  item,
  onOpenChange,
  isDeleting,
  onConfirm,
}: DeleteItemDialogProps) {
  const t = useTranslations("explorer");
  const isFolder = item?.kind === "folder";
  const stats = useFolderStats(isFolder ? item.id : null);
  const name = item?.name ?? "";

  return (
    <ConfirmDialog
      open={Boolean(item)}
      onOpenChange={onOpenChange}
      title={isFolder ? t("moveToTrashTitleFolder", { name }) : t("moveToTrashTitle", { name })}
      description={isFolder ? t("moveToTrashDescriptionFolder") : t("moveToTrashDescription")}
      confirmLabel={isDeleting ? t("movingToTrash") : t("moveToTrashConfirm")}
      variant="destructive"
      isLoading={isDeleting}
      onConfirm={onConfirm}
    >
      {isFolder ? (
        <div className="mt-4 rounded-sm border border-destructive/20 bg-destructive/5 p-3">
          {stats.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
          ) : stats.isError ? (
            <p className="text-sm text-muted-foreground">{t("moveToTrashStatsError")}</p>
          ) : (
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <div className="space-y-0.5 text-sm">
                <p className="font-medium text-foreground">
                  {t("moveToTrashStats", {
                    files: formatCount(stats.data?.fileCount ?? 0, "file"),
                    folders: formatCount(stats.data?.folderCount ?? 0, "subfolder"),
                  })}
                </p>
                <p className="text-muted-foreground">
                  {t("moveToTrashStatsHint", { size: formatBytes(stats.data?.totalSize ?? 0) })}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </ConfirmDialog>
  );
}
