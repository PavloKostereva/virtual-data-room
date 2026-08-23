import type { Metadata } from "next";
import { cache } from "react";
import { ExplorerScreen } from "@/components/explorer/explorer-screen";
import { RoomChrome } from "@/components/layout/room-chrome";
import { ExpiredShareNotice } from "@/components/rooms/expired-share-notice";
import { AppError } from "@/server/errors";
import { createServerContext } from "@/server/http/context";
import { getFolderExplorer } from "@/server/services/folder.service";

interface PageProps {
  params: Promise<{ token: string; folderId: string }>;
}

export const metadata: Metadata = { title: "Shared folder" };

const loadSharedFolder = cache(async (token: string, folderId: string) => {
  const context = await createServerContext(token);
  return getFolderExplorer(context, folderId, {
    sort: "name",
    direction: "asc",
    limit: 50,
  });
});

export default async function SharedFolderPage({ params }: PageProps) {
  const { token, folderId } = await params;

  let data;
  try {
    data = await loadSharedFolder(token, folderId);
  } catch (error) {
    if (error instanceof AppError) return <ExpiredShareNotice />;
    throw error;
  }

  const { view, children } = data;
  const title = view.access.boundaryFolderId
    ? (view.breadcrumbs[0]?.name ?? "Shared folder")
    : view.dataRoom.name;

  return (
    <RoomChrome
      title={title}
      searchFolderId={view.breadcrumbs[0]?.id ?? folderId}
      shareToken={token}
      basePath={`/share/${token}`}
    >
      <ExplorerScreen
        folderId={folderId}
        initialView={view}
        initialChildren={children}
      />
    </RoomChrome>
  );
}
