"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError, apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/keys";
import { uploadWithProgress } from "@/lib/upload";
import type { FileDto, UploadTicketDto } from "@/types/dto";

export type UploadStatus =
  | "queued"
  | "uploading"
  | "finalising"
  | "needs-decision"
  | "done"
  | "error"
  | "cancelled";

export interface UploadItem {
  id: string;
  fileName: string;
  size: number;
  folderId: string;
  status: UploadStatus;

  progress: number;
  error?: string;

  conflict?: { suggestedName: string };

  resolution?: "renamed" | "versioned";
}

interface UploadContextValue {
  uploads: UploadItem[];
  activeCount: number;
  enqueue: (files: File[], folderId: string) => void;
  cancel: (uploadId: string) => void;
  retry: (uploadId: string) => void;
  resolveConflict: (uploadId: string, strategy: "rename" | "version") => void;
  dismiss: (uploadId: string) => void;
  clearFinished: () => void;
}

const UploadContext = createContext<UploadContextValue | null>(null);

const MAX_CONCURRENT_UPLOADS = 3;

interface PendingUpload {
  file: File;
  folderId: string;
  storageKey?: string;
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  const pendingRef = useRef(new Map<string, PendingUpload>());
  const controllersRef = useRef(new Map<string, AbortController>());
  const queueRef = useRef<string[]>([]);
  const activeRef = useRef(0);

  const pumpRef = useRef<() => void>(() => {});

  const patch = useCallback((uploadId: string, changes: Partial<UploadItem>) => {
    setUploads((current) =>
      current.map((upload) => (upload.id === uploadId ? { ...upload, ...changes } : upload)),
    );
  }, []);

  const finaliseUpload = useCallback(
    async (uploadId: string, strategy: "fail" | "rename" | "version") => {
      const pending = pendingRef.current.get(uploadId);
      if (!pending?.storageKey) return;

      patch(uploadId, { status: "finalising", progress: 1 });

      try {
        const result = await apiRequest<{
          file: FileDto;
          resolution: "created" | "renamed" | "versioned";
        }>("/api/files", {
          method: "POST",
          body: {
            folderId: pending.folderId,
            fileName: pending.file.name,
            mimeType: pending.file.type || "application/octet-stream",
            storageKey: pending.storageKey,
            conflictStrategy: strategy,
          },
        });

        patch(uploadId, {
          status: "done",
          progress: 1,
          resolution: result.resolution === "created" ? undefined : result.resolution,
          conflict: undefined,
        });
        pendingRef.current.delete(uploadId);

        await queryClient.invalidateQueries({ queryKey: ["folder", pending.folderId] });
        void queryClient.invalidateQueries({ queryKey: queryKeys.dataRooms });
      } catch (error) {
        if (error instanceof ApiError && error.code === "CONFLICT") {

          patch(uploadId, {
            status: "needs-decision",
            conflict: { suggestedName: error.suggestedName ?? pending.file.name },
          });
          return;
        }
        patch(uploadId, {
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed.",
        });
      }
    },
    [patch, queryClient],
  );

  const runUpload = useCallback(
    async (uploadId: string) => {
      const pending = pendingRef.current.get(uploadId);
      if (!pending) return;

      const controller = new AbortController();
      controllersRef.current.set(uploadId, controller);
      patch(uploadId, { status: "uploading", progress: 0, error: undefined });

      try {
        const { ticket } = await apiRequest<{ ticket: UploadTicketDto }>(
          "/api/files/upload-ticket",
          {
            method: "POST",
            body: {
              folderId: pending.folderId,
              fileName: pending.file.name,
              mimeType: pending.file.type || "application/octet-stream",
              size: pending.file.size,
            },
            signal: controller.signal,
          },
        );

        pendingRef.current.set(uploadId, { ...pending, storageKey: ticket.storageKey });

        await uploadWithProgress({
          url: ticket.url,
          method: ticket.method,
          headers: ticket.headers,
          file: pending.file,
          signal: controller.signal,
          onProgress: ({ loaded, total }) =>
            patch(uploadId, { progress: total > 0 ? loaded / total : 0 }),
        });

        await finaliseUpload(uploadId, "fail");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          patch(uploadId, { status: "cancelled" });
        } else {
          patch(uploadId, {
            status: "error",
            error: error instanceof Error ? error.message : "Upload failed.",
          });
        }
      } finally {
        controllersRef.current.delete(uploadId);
        activeRef.current -= 1;
        pumpRef.current();
      }
    },
    [patch, finaliseUpload],
  );


  const pump = useCallback(() => {
    while (activeRef.current < MAX_CONCURRENT_UPLOADS && queueRef.current.length > 0) {
      const uploadId = queueRef.current.shift();
      if (!uploadId) break;
      activeRef.current += 1;
      void runUpload(uploadId);
    }
  }, [runUpload]);

  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const enqueue = useCallback(
    (files: File[], folderId: string) => {
      if (files.length === 0) return;

      const items: UploadItem[] = files.map((file) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        pendingRef.current.set(id, { file, folderId });
        queueRef.current.push(id);
        return {
          id,
          fileName: file.name,
          size: file.size,
          folderId,
          status: "queued",
          progress: 0,
        };
      });

      setUploads((current) => [...items, ...current]);
      pump();
    },
    [pump],
  );

  const cancel = useCallback((uploadId: string) => {
    controllersRef.current.get(uploadId)?.abort();
    queueRef.current = queueRef.current.filter((id) => id !== uploadId);
    pendingRef.current.delete(uploadId);
  }, []);

  const retry = useCallback(
    (uploadId: string) => {
      const pending = pendingRef.current.get(uploadId);
      if (!pending) return;
      queueRef.current.push(uploadId);
      patch(uploadId, { status: "queued", progress: 0, error: undefined });
      pump();
    },
    [patch, pump],
  );

  const resolveConflict = useCallback(
    (uploadId: string, strategy: "rename" | "version") => {
      void finaliseUpload(uploadId, strategy);
    },
    [finaliseUpload],
  );

  const dismiss = useCallback((uploadId: string) => {
    pendingRef.current.delete(uploadId);
    setUploads((current) => current.filter((upload) => upload.id !== uploadId));
  }, []);

  const clearFinished = useCallback(() => {
    setUploads((current) =>
      current.filter(
        (upload) => upload.status !== "done" && upload.status !== "cancelled",
      ),
    );
  }, []);

  const activeCount = useMemo(
    () =>
      uploads.filter(
        (upload) =>
          upload.status === "queued" ||
          upload.status === "uploading" ||
          upload.status === "finalising",
      ).length,
    [uploads],
  );

  const value = useMemo<UploadContextValue>(
    () => ({ uploads, activeCount, enqueue, cancel, retry, resolveConflict, dismiss, clearFinished }),
    [uploads, activeCount, enqueue, cancel, retry, resolveConflict, dismiss, clearFinished],
  );

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

export function useUploads(): UploadContextValue {
  const context = useContext(UploadContext);
  if (!context) throw new Error("useUploads must be used inside an UploadProvider.");
  return context;
}
