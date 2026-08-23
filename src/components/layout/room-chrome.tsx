"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { RoomSearch } from "@/components/explorer/room-search";
import { ScopeProvider } from "@/components/providers/scope-provider";

interface RoomChromeProps {
  title: string;
  searchFolderId: string | null;
  shareToken?: string | null;
  basePath: string;
  children: ReactNode;
}

export function RoomChrome({
  title,
  searchFolderId,
  shareToken = null,
  basePath,
  children,
}: RoomChromeProps) {
  const t = useTranslations("explorer");

  return (
    <ScopeProvider shareToken={shareToken} basePath={basePath}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-[3.75rem] shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-1.5">
            {!shareToken ? (
              <Link
                href="/rooms"
                aria-label={t("backToRooms")}
                title={t("backToRooms")}
                className="flex size-8 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
              </Link>
            ) : null}
            <h1 className="truncate text-sm font-semibold tracking-tight">{title}</h1>
          </div>
          {searchFolderId ? (
            <div className="ml-auto w-full sm:w-auto sm:min-w-72">
              <RoomSearch scopeFolderId={searchFolderId} />
            </div>
          ) : null}
        </div>
        {children}
      </div>
    </ScopeProvider>
  );
}
