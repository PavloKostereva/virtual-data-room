import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StarredPage } from "@/components/rooms/starred-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("starred") };
}

export default function StarredRoutePage() {
  return <StarredPage />;
}
