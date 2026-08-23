export interface UploadProgressEvent {
  loaded: number;
  total: number;
}

export function uploadWithProgress(params: {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
  file: File;
  onProgress: (event: UploadProgressEvent) => void;
  signal?: AbortSignal;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(params.method, params.url, true);

    for (const [header, value] of Object.entries(params.headers)) {
      request.setRequestHeader(header, value);
    }

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        params.onProgress({ loaded: event.loaded, total: event.total });
      }
    });

    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${request.status}.`));
      }
    });

    request.addEventListener("error", () => reject(new Error("Upload failed. Check your connection.")));
    request.addEventListener("timeout", () => reject(new Error("The upload timed out.")));
    request.addEventListener("abort", () => reject(new DOMException("Upload cancelled", "AbortError")));

    params.signal?.addEventListener("abort", () => request.abort(), { once: true });

    request.send(params.file);
  });
}

export async function extractFilesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const items = Array.from(dataTransfer.items ?? []);
  const entries = items
    .filter((item) => item.kind === "file")
    .map((item) => (typeof item.webkitGetAsEntry === "function" ? item.webkitGetAsEntry() : null));

  if (entries.every((entry) => entry === null)) {
    return Array.from(dataTransfer.files ?? []);
  }

  const files: File[] = [];
  for (const entry of entries) {
    if (entry) await collectEntry(entry, files);
  }
  return files;
}

interface FileSystemEntryLike {
  isFile: boolean;
  isDirectory: boolean;
  file?: (onSuccess: (file: File) => void, onError: (error: unknown) => void) => void;
  createReader?: () => {
    readEntries: (
      onSuccess: (entries: FileSystemEntryLike[]) => void,
      onError: (error: unknown) => void,
    ) => void;
  };
}

const MAX_DROPPED_FILES = 200;

async function collectEntry(entry: FileSystemEntryLike, files: File[]): Promise<void> {
  if (files.length >= MAX_DROPPED_FILES) return;

  if (entry.isFile && entry.file) {
    const file = await new Promise<File | null>((resolve) => {
      entry.file?.(resolve, () => resolve(null));
    });
    if (file) files.push(file);
    return;
  }

  if (entry.isDirectory && entry.createReader) {
    const reader = entry.createReader();
    for (;;) {
      const batch = await new Promise<FileSystemEntryLike[]>((resolve) => {
        reader.readEntries(resolve, () => resolve([]));
      });
      if (batch.length === 0) break;
      for (const child of batch) await collectEntry(child, files);
    }
  }
}
