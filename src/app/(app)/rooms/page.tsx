import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DataRoomsPage } from "@/components/rooms/data-rooms-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("myDataRooms") };
}

export default function RoomsPage() {
  return <DataRoomsPage />;
}
