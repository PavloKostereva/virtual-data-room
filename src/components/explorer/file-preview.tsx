"use client";

import { Download, FileQuestion } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import type { FileDto } from "@/types/dto";

interface FilePreviewProps {
  file: FileDto;

  url: string;
  downloadUrl: string;
}

export function FilePreview({ file, url, downloadUrl }: FilePreviewProps) {
  if (file.mimeType === "application/pdf") {
    return <iframe src={url} title={file.name} className="size-full border-0 bg-white" />;
  }

  if (file.mimeType.startsWith("image/")) {
    return <ImagePreview file={file} url={url} downloadUrl={downloadUrl} />;
  }

  return (
    <EmptyState
      icon={<FileQuestion />}
      title="Preview not available"
      description="This file type cannot be shown in the browser. Download it to open it locally."
      action={
        <Button asChild variant="secondary" size="sm">
          <a href={downloadUrl} download>
            <Download />
            Download
          </a>
        </Button>
      }
      className="h-full"
    />
  );
}

function ImagePreview({
  file,
  url,
  downloadUrl,
}: {
  file: FileDto;
  url: string;
  downloadUrl: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <EmptyState
        icon={<FileQuestion />}
        title="Preview could not be loaded"
        description="The file is saved, but the preview URL failed. Try downloading it."
        action={
          <Button asChild variant="secondary" size="sm">
            <a href={downloadUrl} download>
              <Download />
              Download
            </a>
          </Button>
        }
        className="h-full"
      />
    );
  }

  return (
    <div className="flex size-full items-center justify-center p-6">
      <img
        src={url}
        alt={file.name}
        className="max-h-full max-w-full object-contain"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export function buildContentUrl(params: {
  fileId: string;
  disposition: "inline" | "attachment";
  versionId?: string | null;
  shareToken?: string | null;
}): string {
  const search = new URLSearchParams({ disposition: params.disposition });
  if (params.versionId) search.set("versionId", params.versionId);
  if (params.shareToken) search.set("shareToken", params.shareToken);
  return `/api/files/${params.fileId}/content?${search.toString()}`;
}
