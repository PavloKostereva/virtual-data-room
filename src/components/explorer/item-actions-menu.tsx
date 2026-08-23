"use client";

import {
  Copy,
  Download,
  FolderInput,
  MoreVertical,
  PencilLine,
  Share2,
  Star,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { fileKindLabel, ItemIcon } from "@/components/explorer/file-icon";
import { useScope } from "@/components/providers/scope-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToggleStar } from "@/hooks/use-stars";
import { ApiError } from "@/lib/api-client";
import type { ExplorerItemDto } from "@/types/dto";

interface ItemActionsMenuProps {
  item: ExplorerItemDto;
  href: string;
  canWrite: boolean;
  canShare: boolean;
  onOpen: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onShare: () => void;
  onPreview: () => void;
  triggerClassName?: string;
}

export function ItemActionsMenu({
  item,
  href,
  canWrite,
  canShare,
  onOpen,
  onRename,
  onMove,
  onDelete,
  onShare,
  onPreview,
  triggerClassName,
}: ItemActionsMenuProps) {
  const scope = useScope();
  const t = useTranslations("explorer");
  const toggleStar = useToggleStar();
  const isStarred = Boolean(item.starred);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${href}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("linkCopied"));
    } catch {
      toast.error(t("linkCopyError"));
    }
  };

  const handleToggleStar = () => {
    toggleStar.mutate(item, {
      onSuccess: (result) =>
        toast.success(
          result.starred
            ? t("starredToast", { name: item.name })
            : t("unstarredToast", { name: item.name }),
        ),
      onError: (error) =>
        toast.error(error instanceof ApiError ? error.message : t("starError")),
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="iconSm"
          aria-label={t("actionsFor", { name: item.name })}
          className={triggerClassName}
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {item.kind === "file" ? (
          <>
            <DropdownMenuItem onSelect={onPreview}>
              <ItemIcon kind="file" mimeType={item.mimeType} className="size-4" />
              {t("open")} {fileKindLabel(item.mimeType).toLowerCase()}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a
                href={`/api/files/${item.id}/content?disposition=attachment${
                  scope.shareToken ? `&shareToken=${encodeURIComponent(scope.shareToken)}` : ""
                }`}
                download
              >
                <Download />
                {t("download")}
              </a>
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onSelect={onOpen}>
            <ItemIcon kind="folder" className="size-4" />
            {t("openFolder")}
          </DropdownMenuItem>
        )}

        {!scope.shareToken ? (
          <DropdownMenuItem onSelect={handleToggleStar}>
            <Star className={isStarred ? "fill-current text-amber-500" : undefined} />
            {isStarred ? t("removeStar") : t("addStar")}
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuItem onSelect={() => void handleCopyLink()}>
          <Copy />
          {t("copyLink")}
        </DropdownMenuItem>

        {canShare ? (
          <DropdownMenuItem onSelect={onShare}>
            <Share2 />
            {t("share")}
          </DropdownMenuItem>
        ) : null}

        {canWrite ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onRename}>
              <PencilLine />
              {t("rename")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onMove}>
              <FolderInput />
              {t("moveItem")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 />
              {t("deleteItem")}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
