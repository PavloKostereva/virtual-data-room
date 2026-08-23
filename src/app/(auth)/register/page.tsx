import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { RegisterForm } from "@/components/auth/auth-form";
import { getSession } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("register") };
}

export default async function RegisterPage() {
  if (await getSession()) redirect("/rooms");
  return <RegisterForm />;
}
