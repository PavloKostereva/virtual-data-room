"use client";

import { Download, History, Lock, Share2 } from "lucide-react";
import { useState } from "react";
import { Breadcrumbs } from "@/components/explorer/breadcrumbs";
import { buildContentUrl, FilePreview } from "@/components/explorer/file-preview";
import { VersionList } from "@/components/explorer/version-list";
import { ShareDialog } from "@/components/dialogs/share-dialog";
import { useScope } from "@/components/providers/scope-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/feedback";
import { useFileDetail } from "@/hooks/use-explorer";
import type { ShareSubject } from "@/hooks/use-shares";
import { ApiError } from "@/lib/api-client";
import { formatBytes, formatDateTime } from "@/lib/format";

export function FileScreen({ fileId }: { fileId: string }) {
  const scope = useScope();
  const detail = useFileDetail(fileId);
  const [showVersions, setShowVersions] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [shareSubject, setShareSubject] = useState<ShareSubject | null>(null);

  if (detail.isPending) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-6">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="min-h-96 flex-1 rounded-lg" />
      </div>
    );
  }

  if (detail.isError) {
    const isMissing =
      detail.error instanceof ApiError &&
      (detail.error.status === 404 || detail.error.status === 403);

    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        {isMissing ? (
          <EmptyState
            icon={<Lock />}
            title="This file is not available"
            description="It may have been deleted, or the access that was shared with you has been revoked."
          />
        ) : (
          <ErrorState
            message="The file could not be loaded."
            onRetry={() => void detail.refetch()}
          />
        )}
      </div>
    );
  }

  const file = detail.data;
  const contentUrl = buildContentUrl({
    fileId,
    disposition: "inline",
    versionId: selectedVersionId,
    shareToken: scope.shareToken,
  });
  const downloadUrl = buildContentUrl({
    fileId,
    disposition: "attachment",
    versionId: selectedVersionId,
    shareToken: scope.shareToken,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <Breadcrumbs items={[...file.breadcrumbs, { id: file.id, name: file.name }]} />
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatBytes(file.size)} · Updated {formatDateTime(file.updatedAt)}
          </p>
        </div>

        {scope.isPublicView ? <Badge variant="accent">Read-only</Badge> : null}

        {file.versionCount > 1 ? (
          <Button
            variant={showVersions ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowVersions((value) => !value)}
          >
            <History />
            {file.versionCount} versions
          </Button>
        ) : null}

        {file.access.canShare ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShareSubject({ type: "FILE", id: file.id, name: file.name })}
          >
            <Share2 />
            Share
          </Button>
        ) : null}

        <Button size="sm" asChild>
          <a href={downloadUrl} download>
            <Download />
            Download
          </a>
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-h-96 min-w-0 flex-1 bg-muted/60">
          <FilePreview file={file} url={contentUrl} downloadUrl={downloadUrl} />
        </div>

        {showVersions ? (
          <aside className="scrollbar-thin w-64 shrink-0 overflow-y-auto border-l border-border p-3">
            <VersionList
              versions={file.versions}
              isLoading={false}
              selectedVersionId={selectedVersionId}
              onSelect={setSelectedVersionId}
            />
          </aside>
        ) : null}
      </div>

      <ShareDialog subject={shareSubject} onOpenChange={(open) => !open && setShareSubject(null)} />
    </div>
  );
}
