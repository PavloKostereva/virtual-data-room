"use client";

import { LayoutGrid, LayoutList } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { ExplorerLayout } from "@/hooks/use-explorer-layout";

export const COLLECTION_GRID_CLASS =
  "grid grid-cols-[repeat(auto-fill,13.5rem)] content-start gap-3";

export const COLLECTION_CARD_CLASS =
  "relative flex h-44 w-[13.5rem] flex-col overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md";

export const COLLECTION_LIST_CLASS =
  "divide-y divide-border overflow-hidden rounded-lg border border-border bg-card";

export const COLLECTION_ROW_CLASS =
  "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted";

interface LayoutToggleProps {
  layout: ExplorerLayout;
  onLayoutChange: (layout: ExplorerLayout) => void;
}

export function LayoutToggle({ layout, onLayoutChange }: LayoutToggleProps) {
  const t = useTranslations("explorer");

  return (
    <div className="flex shrink-0 items-center rounded-sm border border-border p-0.5">
      <Button
        type="button"
        variant={layout === "list" ? "secondary" : "ghost"}
        size="iconSm"
        aria-label={t("viewList")}
        aria-pressed={layout === "list"}
        onClick={() => onLayoutChange("list")}
      >
        <LayoutList />
      </Button>
      <Button
        type="button"
        variant={layout === "grid" ? "secondary" : "ghost"}
        size="iconSm"
        aria-label={t("viewGrid")}
        aria-pressed={layout === "grid"}
        onClick={() => onLayoutChange("grid")}
      >
        <LayoutGrid />
      </Button>
    </div>
  );
}
