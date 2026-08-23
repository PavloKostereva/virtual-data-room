"use client";

import { CornerDownLeft, Loader2, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { fileKindLabel, ItemIcon } from "@/components/explorer/file-icon";
import { fileHref, folderHref, useScope } from "@/components/providers/scope-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSearch } from "@/hooks/use-explorer";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

export function RoomSearch({ scopeFolderId }: { scopeFolderId: string }) {
  const t = useTranslations("explorer");
  const tc = useTranslations("common");
  const scope = useScope();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 250);
  const search = useSearch(scopeFolderId, debouncedQuery);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const isSearching = debouncedQuery.trim().length >= 2;
  const results = search.data ?? [];

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(event) => event.key === "Escape" && setIsOpen(false)}
        placeholder={t("searchThisRoom")}
        aria-label={t("searchThisRoomAria")}
        className="pl-8 pr-8"
      />
      {query.length > 0 ? (
        <Button
          variant="ghost"
          size="iconSm"
          aria-label={tc("clearSearch")}
          className="absolute right-0.5 top-1/2 -translate-y-1/2"
          onClick={() => {
            setQuery("");
            setIsOpen(false);
          }}
        >
          <X />
        </Button>
      ) : null}

      {isOpen && isSearching ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-md border border-border bg-card shadow-lg">
          {search.isPending ? (
            <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t("searching")}
            </p>
          ) : search.isError ? (
            <p className="px-3 py-3 text-sm text-destructive">{t("searchError")}</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              {t("searchNoMatch", { query: debouncedQuery.trim() })}
            </p>
          ) : (
            <ul className="scrollbar-thin max-h-80 overflow-y-auto py-1">
              {results.map((result) => {
                const href =
                  result.item.kind === "folder"
                    ? folderHref(scope, result.item.id)
                    : fileHref(scope, result.item.id);

                return (
                  <li key={`${result.item.kind}-${result.item.id}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        router.push(href);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted",
                      )}
                    >
                      <ItemIcon
                        kind={result.item.kind}
                        mimeType={result.item.kind === "file" ? result.item.mimeType : undefined}
                        className="size-4 shrink-0"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-foreground">
                          {result.item.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {result.item.kind === "file"
                            ? `${fileKindLabel(result.item.mimeType)} · ${formatBytes(result.item.size)} · `
                            : `${t("folderLabel")} · `}
                          {result.location.join(" / ") || t("allFiles")}
                        </span>
                      </span>
                      <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
