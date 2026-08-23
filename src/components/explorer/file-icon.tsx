import {
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Folder as FolderIcon,
  Presentation,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ItemIconProps {
  kind: "folder" | "file";
  mimeType?: string;
  className?: string;
}

export function ItemIcon({ kind, mimeType = "", className }: ItemIconProps) {
  if (kind === "folder") {
    return <FolderIcon className={cn("size-5 fill-primary/15 text-primary", className)} />;
  }

  if (mimeType === "application/pdf") {
    return <FileType className={cn("size-5 text-destructive", className)} />;
  }
  if (mimeType.startsWith("image/")) {
    return <FileImage className={cn("size-5 text-success", className)} />;
  }
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") {
    return <FileSpreadsheet className={cn("size-5 text-success", className)} />;
  }
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) {
    return <Presentation className={cn("size-5 text-warning", className)} />;
  }

  return <FileText className={cn("size-5 text-muted-foreground", className)} />;
}

export function fileKindLabel(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.startsWith("image/")) return "Image";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "Spreadsheet";
  if (mimeType.includes("presentation")) return "Presentation";
  if (mimeType.includes("word")) return "Document";
  if (mimeType === "text/csv") return "CSV";
  if (mimeType === "text/plain") return "Text";
  return "File";
}
