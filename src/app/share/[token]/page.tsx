import { redirect } from "next/navigation";
import { ExpiredShareNotice } from "@/components/rooms/expired-share-notice";
import { AppError } from "@/server/errors";
import { resolvePublicShare } from "@/server/services/share.service";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let target;
  try {
    target = await resolvePublicShare(token);
  } catch (error) {
    if (error instanceof AppError) return <ExpiredShareNotice />;
    throw error;
  }

  if (target.fileId) redirect(`/share/${token}/files/${target.fileId}`);
  if (target.folderId) redirect(`/share/${token}/folders/${target.folderId}`);

  return <ExpiredShareNotice />;
}
