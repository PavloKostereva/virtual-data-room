import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/auth-form";
import { getSession } from "@/server/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return { title: t("signIn") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; reset?: string }>;
}) {
  if (await getSession()) redirect("/rooms");
  const { registered, reset } = await searchParams;
  return <LoginForm justRegistered={registered === "1"} justReset={reset === "1"} />;
}
