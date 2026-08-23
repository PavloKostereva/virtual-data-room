import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TrashPage } from "@/components/rooms/trash-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("trash") };
}

export default function TrashRoutePage() {
  return <TrashPage />;
}
