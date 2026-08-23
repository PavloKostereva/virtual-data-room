"use client";

import { useEffect, useState } from "react";

export type ExplorerLayout = "list" | "grid";

const STORAGE_KEY = "vault:explorer-layout";

export function useExplorerLayout() {
  const [layout, setLayoutState] = useState<ExplorerLayout>("list");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "list" || stored === "grid") {
      setLayoutState(stored);
    }
    setIsReady(true);
  }, []);

  const setLayout = (next: ExplorerLayout) => {
    setLayoutState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return { layout, setLayout, isReady };
}
