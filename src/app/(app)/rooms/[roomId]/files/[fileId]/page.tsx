import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileScreen } from "@/components/explorer/file-screen";
import { RoomChrome } from "@/components/layout/room-chrome";
import { AppError } from "@/server/errors";
import { createServerContext } from "@/server/http/context";
import { getFileDetail } from "@/server/services/file.service";

interface PageProps {
  params: Promise<{ roomId: string; fileId: string }>;
}

async function loadFile(fileId: string) {
  try {
    return await getFileDetail(await createServerContext(), fileId);
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { fileId } = await params;
  const file = await loadFile(fileId);
  return { title: file.name };
}

export default async function FilePage({ params }: PageProps) {
  const { roomId, fileId } = await params;
  const file = await loadFile(fileId);

  const isFileScopedShare = file.breadcrumbs.length === 0;
  const title = isFileScopedShare
    ? file.name
    : file.access.boundaryFolderId
      ? (file.breadcrumbs[0]?.name ?? "Shared file")
      : file.dataRoom.name;

  return (
    <RoomChrome
      title={title}
      searchFolderId={isFileScopedShare ? null : (file.breadcrumbs[0]?.id ?? null)}
      basePath={`/rooms/${roomId}`}
    >
      <FileScreen fileId={fileId} />
    </RoomChrome>
  );
}
