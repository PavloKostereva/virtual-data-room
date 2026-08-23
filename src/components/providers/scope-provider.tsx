"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

export interface ExplorerScope {
  shareToken: string | null;

  basePath: string;

  isPublicView: boolean;
}

const ScopeContext = createContext<ExplorerScope | null>(null);

export function ScopeProvider({
  shareToken = null,
  basePath,
  children,
}: {
  shareToken?: string | null;
  basePath: string;
  children: ReactNode;
}) {
  const value = useMemo<ExplorerScope>(
    () => ({ shareToken, basePath, isPublicView: Boolean(shareToken) }),
    [shareToken, basePath],
  );

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope(): ExplorerScope {
  const scope = useContext(ScopeContext);
  if (!scope) throw new Error("useScope must be used inside a ScopeProvider.");
  return scope;
}

export function folderHref(scope: ExplorerScope, folderId: string): string {
  return `${scope.basePath}/folders/${folderId}`;
}

export function fileHref(scope: ExplorerScope, fileId: string): string {
  return `${scope.basePath}/files/${fileId}`;
}
