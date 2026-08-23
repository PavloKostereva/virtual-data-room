import type { Metadata } from "next";
import { FileScreen } from "@/components/explorer/file-screen";
import { RoomChrome } from "@/components/layout/room-chrome";
import { ExpiredShareNotice } from "@/components/rooms/expired-share-notice";
import { AppError } from "@/server/errors";
import { createServerContext } from "@/server/http/context";
import { getFileDetail } from "@/server/services/file.service";

interface PageProps {
  params: Promise<{ token: string; fileId: string }>;
}

export const metadata: Metadata = { title: "Shared file" };

export default async function SharedFilePage({ params }: PageProps) {
  const { token, fileId } = await params;

  let file;
  try {
    file = await getFileDetail(await createServerContext(token), fileId);
  } catch (error) {
    if (error instanceof AppError) return <ExpiredShareNotice />;
    throw error;
  }

  const isFileScopedShare = file.breadcrumbs.length === 0;

  return (
    <RoomChrome
      title={isFileScopedShare ? file.name : (file.breadcrumbs[0]?.name ?? file.dataRoom.name)}
      searchFolderId={isFileScopedShare ? null : (file.breadcrumbs[0]?.id ?? null)}
      shareToken={token}
      basePath={`/share/${token}`}
    >
      <FileScreen fileId={fileId} />
    </RoomChrome>
  );
}
