"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { localeNames, type Locale } from "@/i18n/config";
import { setLocale } from "@/i18n/actions";

export function LocaleSwitcherItems() {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const switchLocale = (nextLocale: Locale) => {
    if (nextLocale === locale || isPending) return;
    startTransition(async () => {
      await setLocale(nextLocale);
      router.refresh();
    });
  };

  return (
    <>
      <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
      {(Object.keys(localeNames) as Locale[]).map((code) => (
        <DropdownMenuItem
          key={code}
          disabled={isPending}
          onSelect={() => switchLocale(code)}
          className={code === locale ? "font-medium" : undefined}
        >
          <Languages />
          {localeNames[code]}
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
    </>
  );
}
