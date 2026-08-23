import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SharedWithMePage } from "@/components/rooms/shared-with-me-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("sharedWithMe") };
}

export default function SharedPage() {
  return <SharedWithMePage />;
}
