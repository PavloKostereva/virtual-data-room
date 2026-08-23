import { Vault } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { UploadProvider } from "@/hooks/use-uploads";

export default async function ShareLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("shareLayout");
  const tc = await getTranslations("common");

  return (
    <UploadProvider>
      <div className="flex h-dvh flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-4 sm:px-6">
          <Vault className="size-5 text-primary" aria-hidden />
          <span className="text-sm font-semibold tracking-tight">{tc("appName")}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {t("sharedWithYou")} ·{" "}
            <Link href="/login" className="font-medium text-primary hover:underline">
              {t("signIn")}
            </Link>
          </span>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
      </div>
    </UploadProvider>
  );
}
