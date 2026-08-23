import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ExplorerScreen } from "@/components/explorer/explorer-screen";
import { RoomChrome } from "@/components/layout/room-chrome";
import { AppError } from "@/server/errors";
import { createServerContext } from "@/server/http/context";
import { getFolderExplorer } from "@/server/services/folder.service";
import type { ExplorerItemDto, FolderViewDto, PageDto } from "@/types/dto";

interface PageProps {
  params: Promise<{ roomId: string; folderId: string }>;
}

const loadFolderPage = cache(async (folderId: string): Promise<{
  view: FolderViewDto;
  children: PageDto<ExplorerItemDto>;
}> => {
  try {
    const context = await createServerContext();
    return await getFolderExplorer(context, folderId, {
      sort: "name",
      direction: "asc",
      limit: 50,
    });
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { folderId } = await params;
  const { view } = await loadFolderPage(folderId);
  return { title: view.folder.parentId === null ? view.dataRoom.name : view.folder.name };
}

export default async function FolderPage({ params }: PageProps) {
  const { roomId, folderId } = await params;
  const { view, children } = await loadFolderPage(folderId);

  const title = view.access.boundaryFolderId
    ? (view.breadcrumbs[0]?.name ?? "Shared folder")
    : view.dataRoom.name;

  const searchFolderId = view.breadcrumbs[0]?.id ?? folderId;

  return (
    <RoomChrome title={title} searchFolderId={searchFolderId} basePath={`/rooms/${roomId}`}>
      <ExplorerScreen
        folderId={folderId}
        initialView={view}
        initialChildren={children}
      />
    </RoomChrome>
  );
}
