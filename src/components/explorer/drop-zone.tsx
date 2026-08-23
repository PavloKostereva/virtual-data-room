"use client";

import { UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState, type DragEvent, type ReactNode } from "react";
import { hasDataTransferType } from "@/lib/dnd";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
  children: ReactNode;
}

export function DropZone({ disabled = false, onFiles, className, children }: DropZoneProps) {
  const t = useTranslations("explorer");
  const [isDragging, setIsDragging] = useState(false);
  const dragDepth = useRef(0);

  const isFileDrag = (event: DragEvent) => hasDataTransferType(event, "Files");

  const handleDragEnter = useCallback(
    (event: DragEvent) => {
      if (disabled || !isFileDrag(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setIsDragging(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((event: DragEvent) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback(
    (event: DragEvent) => {
      if (disabled || !isFileDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (event: DragEvent) => {
      if (disabled || !isFileDrag(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [disabled, onFiles],
  );

  return (
    <div
      className={cn("relative", className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {isDragging ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/5 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-2 rounded-md bg-card px-6 py-4 shadow-lg">
            <UploadCloud className="size-6 text-primary" aria-hidden />
            <p className="text-sm font-medium text-foreground">{t("dropToUpload")}</p>
            <p className="text-xs text-muted-foreground">{t("dropToUploadHint")}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
