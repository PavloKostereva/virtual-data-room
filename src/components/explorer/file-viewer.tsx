"use client";

import { Download, History, X } from "lucide-react";
import { useMemo, useState } from "react";
import { buildContentUrl, FilePreview } from "@/components/explorer/file-preview";
import { VersionList } from "@/components/explorer/version-list";
import { useScope } from "@/components/providers/scope-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useFileDetail } from "@/hooks/use-explorer";
import { formatBytes } from "@/lib/format";
import type { FileDto } from "@/types/dto";

interface FileViewerProps {
  file: FileDto | null;
  onOpenChange: (open: boolean) => void;
}

export function FileViewer({ file, onOpenChange }: FileViewerProps) {
  const scope = useScope();
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);

  const detail = useFileDetail(file && file.versionCount > 1 ? file.id : null);
  const versions = detail.data?.versions ?? [];

  const contentUrl = useMemo(
    () =>
      file
        ? buildContentUrl({
            fileId: file.id,
            disposition: "inline",
            versionId: selectedVersionId,
            shareToken: scope.shareToken,
          })
        : "",
    [file, selectedVersionId, scope.shareToken],
  );

  const downloadUrl = file
    ? buildContentUrl({
        fileId: file.id,
        disposition: "attachment",
        versionId: selectedVersionId,
        shareToken: scope.shareToken,
      })
    : "";

  const close = (open: boolean) => {
    if (!open) {
      setSelectedVersionId(null);
      setShowVersions(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={Boolean(file)} onOpenChange={close}>
      <DialogContent
        showClose={false}
        className="flex h-[90vh] max-h-[90vh] w-[min(1100px,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden p-0"
      >
        <header className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-foreground">{file?.name}</h2>
            <p className="text-xs text-muted-foreground">
              {formatBytes(file?.size ?? 0)}
              {file && file.versionCount > 1 ? ` · ${file.versionCount} versions` : ""}
            </p>
          </div>

          {file && file.versionCount > 1 ? (
            <Button
              variant={showVersions ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setShowVersions((value) => !value)}
            >
              <History />
              Versions
            </Button>
          ) : null}

          <Button variant="secondary" size="sm" asChild>
            <a href={downloadUrl} download>
              <Download />
              Download
            </a>
          </Button>

          <Button variant="ghost" size="iconSm" aria-label="Close preview" onClick={() => close(false)}>
            <X />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 bg-muted/60">
            {file ? (
              <FilePreview file={file} url={contentUrl} downloadUrl={downloadUrl} />
            ) : null}
          </div>

          {showVersions ? (
            <aside className="scrollbar-thin w-64 shrink-0 overflow-y-auto border-l border-border p-3">
              <VersionList
                versions={versions}
                isLoading={detail.isPending}
                selectedVersionId={selectedVersionId}
                onSelect={setSelectedVersionId}
              />
            </aside>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
