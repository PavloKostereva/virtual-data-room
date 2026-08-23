import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { getAppUser } from "@/server/services/auth.service";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getAppUser();
  if (!user) redirect("/login");

  return <AppShell user={user}>{children}</AppShell>;
}
