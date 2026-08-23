"use client";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/feedback";
import { formatBytes, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FileVersionDto } from "@/types/dto";

interface VersionListProps {
  versions: FileVersionDto[];
  isLoading: boolean;
  selectedVersionId: string | null;
  onSelect: (versionId: string | null) => void;
}

export function VersionList({
  versions,
  isLoading,
  selectedVersionId,
  onSelect,
}: VersionListProps) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Version history
      </h3>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : versions.length === 0 ? (
        <p className="text-xs text-muted-foreground">No earlier versions.</p>
      ) : (
        <ul className="space-y-1">
          {versions.map((version) => {
            const isActive = selectedVersionId
              ? selectedVersionId === version.id
              : version.isCurrent;

            return (
              <li key={version.id}>
                <button
                  type="button"
                  onClick={() => onSelect(version.isCurrent ? null : version.id)}
                  className={cn(
                    "w-full rounded-sm px-2.5 py-2 text-left transition-colors hover:bg-muted",
                    isActive && "bg-accent",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium">v{version.versionNumber}</span>
                    {version.isCurrent ? <Badge variant="success">Current</Badge> : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {formatDateTime(version.createdAt)} · {formatBytes(version.size)}
                  </span>
                  {version.uploadedBy ? (
                    <span className="block text-xs text-muted-foreground">
                      by {version.uploadedBy}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
