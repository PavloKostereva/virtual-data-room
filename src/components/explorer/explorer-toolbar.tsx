"use client";

import { ArrowDownAZ, ArrowUpAZ, Clock, FolderPlus, Share2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef } from "react";
import { LayoutToggle } from "@/components/layout/layout-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExplorerLayout } from "@/hooks/use-explorer-layout";
import type { SortState } from "@/hooks/use-explorer";

interface ExplorerToolbarProps {
  canWrite: boolean;
  canShare: boolean;
  sort: SortState;
  layout: ExplorerLayout;
  onLayoutChange: (layout: ExplorerLayout) => void;
  onSortChange: (sort: SortState) => void;
  onCreateFolder: () => void;
  onFilesSelected: (files: File[]) => void;
  onShare: () => void;
}

export function ExplorerToolbar({
  canWrite,
  canShare,
  sort,
  layout,
  onLayoutChange,
  onSortChange,
  onCreateFolder,
  onFilesSelected,
  onShare,
}: ExplorerToolbarProps) {
  const t = useTranslations("explorer");
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <LayoutToggle layout={layout} onLayoutChange={onLayoutChange} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            {sort.field === "updatedAt" ? (
              <Clock />
            ) : sort.direction === "asc" ? (
              <ArrowDownAZ />
            ) : (
              <ArrowUpAZ />
            )}
            {sort.field === "updatedAt" ? t("sortLastModified") : t("columnName")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t("sortBy")}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onSortChange({ field: "name", direction: "asc" })}>
            <ArrowDownAZ />
            {t("sortNameAsc")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onSortChange({ field: "name", direction: "desc" })}>
            <ArrowUpAZ />
            {t("sortNameDesc")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => onSortChange({ field: "updatedAt", direction: "desc" })}
          >
            <Clock />
            {t("sortLastModified")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {canShare ? (
        <Button variant="secondary" size="sm" onClick={onShare}>
          <Share2 />
          {t("share")}
        </Button>
      ) : null}

      {canWrite ? (
        <>
          <Button variant="secondary" size="sm" onClick={onCreateFolder}>
            <FolderPlus />
            {t("newFolder")}
          </Button>

          <Button size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload />
            {t("uploadFiles")}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length > 0) onFilesSelected(files);

              event.target.value = "";
            }}
          />
        </>
      ) : null}
    </div>
  );
}
