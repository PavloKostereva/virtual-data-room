"use client";

import { FolderLock, KeyRound, LogOut, Menu, Share2, Star, Trash2, Vault, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { UploadTray } from "@/components/explorer/upload-tray";
import { ChangePasswordDialog } from "@/components/dialogs/change-password-dialog";
import { LocaleSwitcherItems } from "@/components/layout/locale-switcher";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UploadProvider } from "@/hooks/use-uploads";
import { useLogout } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { UserDto } from "@/types/dto";

export function AppShell({ user, children }: { user: UserDto; children: ReactNode }) {
  const pathname = usePathname();
  const logout = useLogout();
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const navItems = [
    { href: "/rooms", label: t("myDataRooms"), icon: FolderLock },
    { href: "/shared", label: t("sharedWithMe"), icon: Share2 },
    { href: "/starred", label: t("starred"), icon: Star },
    { href: "/trash", label: t("trash"), icon: Trash2 },
  ];

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <UploadProvider>
      <div className="flex h-dvh overflow-hidden">
        <div className="order-1 flex min-w-0 flex-1 flex-col md:order-2">
          <div className="flex h-[3.75rem] shrink-0 items-center border-b border-border px-4 md:hidden">
            <Vault className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="ml-2 truncate text-sm font-semibold">{tc("appName")}</span>
            <Button
              variant="ghost"
              size="iconSm"
              className="ml-auto"
              aria-label={t("openNavigation")}
              onClick={() => setIsNavOpen(true)}
            >
              <Menu />
            </Button>
          </div>

          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
        </div>

        {isNavOpen ? (
          <button
            type="button"
            aria-label={t("closeNavigation")}
            onClick={() => setIsNavOpen(false)}
            className="fixed inset-0 z-30 bg-foreground/20 md:hidden"
          />
        ) : null}

        <aside
          className={cn(
            "order-2 fixed inset-y-0 right-0 z-40 flex w-64 shrink-0 flex-col border-l border-border bg-card transition-transform duration-200 ease-out md:order-1 md:static md:inset-auto md:right-auto md:left-0 md:border-l-0 md:border-r md:duration-0",
            isNavOpen ? "translate-x-0" : "translate-x-full md:translate-x-0",
          )}
        >
          <div className="flex h-[3.75rem] shrink-0 items-center gap-2 border-b border-border px-4">
            <Vault className="size-5 text-primary" aria-hidden />
            <span className="text-sm font-semibold tracking-tight">{tc("appName")}</span>
            <Button
              variant="ghost"
              size="iconSm"
              className="ml-auto md:hidden"
              aria-label={t("closeNavigation")}
              onClick={() => setIsNavOpen(false)}
            >
              <X />
            </Button>
          </div>

          <nav className="flex-1 space-y-0.5 p-3">
            {navItems.map((item) => {
              const isActive =
                item.href === "/rooms"
                  ? pathname === "/rooms"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsNavOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-left transition-colors hover:bg-muted"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {initials || "?"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{user.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {user.email}
                    </span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <LocaleSwitcherItems />
                <DropdownMenuItem
                  onSelect={(event) => {
                    event.preventDefault();
                    setChangePasswordOpen(true);
                  }}
                >
                  <KeyRound />
                  {t("changePassword")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => logout.mutate()}
                  disabled={logout.isPending}
                >
                  <LogOut />
                  {t("signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>
      </div>

      <UploadTray />
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
    </UploadProvider>
  );
}
