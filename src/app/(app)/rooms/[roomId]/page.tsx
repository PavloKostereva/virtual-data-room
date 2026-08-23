import { notFound, redirect } from "next/navigation";
import { AppError } from "@/server/errors";
import { createServerContext } from "@/server/http/context";
import { getDataRoom } from "@/server/services/dataroom.service";

export default async function DataRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  try {
    const dataRoom = await getDataRoom(await createServerContext(), roomId);
    redirect(`/rooms/${roomId}/folders/${dataRoom.rootFolderId}`);
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }
}
