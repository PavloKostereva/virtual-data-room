"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Copy,
  Layers,
  RotateCw,
  X,
} from "lucide-react";
import { useState } from "react";
import { ItemIcon } from "@/components/explorer/file-icon";
import { Button } from "@/components/ui/button";
import { useUploads, type UploadItem } from "@/hooks/use-uploads";
import { formatBytes, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export function UploadTray() {
  const { uploads, activeCount, cancel, retry, resolveConflict, dismiss, clearFinished } =
    useUploads();
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (uploads.length === 0) return null;

  const finishedCount = uploads.filter((upload) => upload.status === "done").length;
  const title =
    activeCount > 0
      ? `Uploading ${activeCount} ${activeCount === 1 ? "file" : "files"}`
      : `${finishedCount} of ${uploads.length} uploaded`;

  return (
    <section
      aria-label="Uploads"
      className="fixed bottom-4 right-4 z-40 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-card shadow-2xl shadow-foreground/10"
    >
      <header className="flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-2">
        <h2 className="flex-1 text-sm font-medium text-foreground">{title}</h2>
        {activeCount === 0 ? (
          <Button variant="ghost" size="iconSm" aria-label="Clear finished" onClick={clearFinished}>
            <X />
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="iconSm"
          aria-label={isCollapsed ? "Expand uploads" : "Collapse uploads"}
          aria-expanded={!isCollapsed}
          onClick={() => setIsCollapsed((value) => !value)}
        >
          <ChevronDown className={cn("transition-transform", isCollapsed && "rotate-180")} />
        </Button>
      </header>

      {isCollapsed ? null : (
        <ul className="scrollbar-thin max-h-80 divide-y divide-border overflow-y-auto">
          {uploads.map((upload) => (
            <UploadRow
              key={upload.id}
              upload={upload}
              onCancel={() => cancel(upload.id)}
              onRetry={() => retry(upload.id)}
              onDismiss={() => dismiss(upload.id)}
              onResolve={(strategy) => resolveConflict(upload.id, strategy)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface UploadRowProps {
  upload: UploadItem;
  onCancel: () => void;
  onRetry: () => void;
  onDismiss: () => void;
  onResolve: (strategy: "rename" | "version") => void;
}

function UploadRow({ upload, onCancel, onRetry, onDismiss, onResolve }: UploadRowProps) {
  const isBusy =
    upload.status === "queued" || upload.status === "uploading" || upload.status === "finalising";

  return (
    <li className="px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <ItemIcon kind="file" className="size-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-foreground">{upload.fileName}</p>
          <p className="text-xs text-muted-foreground">
            <UploadStatusLabel upload={upload} />
          </p>
        </div>

        {upload.status === "done" ? (
          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
        ) : upload.status === "error" ? (
          <Button variant="ghost" size="iconSm" aria-label="Retry upload" onClick={onRetry}>
            <RotateCw />
          </Button>
        ) : isBusy ? (
          <Button variant="ghost" size="iconSm" aria-label="Cancel upload" onClick={onCancel}>
            <X />
          </Button>
        ) : upload.status === "needs-decision" ? (
          <AlertCircle className="size-4 shrink-0 text-warning" aria-hidden />
        ) : (
          <Button variant="ghost" size="iconSm" aria-label="Dismiss" onClick={onDismiss}>
            <X />
          </Button>
        )}
      </div>

      {isBusy ? (
        <div
          role="progressbar"
          aria-valuenow={Math.round(upload.progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Upload progress for ${upload.fileName}`}
          className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200"
            style={{ width: formatPercent(upload.progress) }}
          />
        </div>
      ) : null}

      {upload.status === "needs-decision" ? (
        <div className="mt-2 rounded-sm bg-warning/10 p-2">
          <p className="text-xs text-foreground">
            A file with this name already exists in this folder.
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => onResolve("version")}>
              <Layers />
              Save as new version
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onResolve("rename")}>
              <Copy />
              Keep both
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function UploadStatusLabel({ upload }: { upload: UploadItem }) {
  switch (upload.status) {
    case "queued":
      return <>Waiting… · {formatBytes(upload.size)}</>;
    case "uploading":
      return (
        <>
          {formatPercent(upload.progress)} of {formatBytes(upload.size)}
        </>
      );
    case "finalising":
      return <>Finishing up…</>;
    case "needs-decision":
      return <>Needs your decision</>;
    case "done":
      return upload.resolution === "versioned" ? (
        <>Saved as a new version</>
      ) : upload.resolution === "renamed" ? (
        <>Uploaded as a copy</>
      ) : (
        <>Uploaded · {formatBytes(upload.size)}</>
      );
    case "cancelled":
      return <>Cancelled</>;
    case "error":
      return <span className="text-destructive">{upload.error ?? "Upload failed"}</span>;
    default:
      return null;
  }
}
