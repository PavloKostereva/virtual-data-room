"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "primary" | "destructive";
  isLoading?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  variant = "primary",
  isLoading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const t = useTranslations("common");
  const resolvedCancelLabel = cancelLabel ?? t("cancel");

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="animate-overlay-in fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px]" />
        <AlertDialogPrimitive.Content
          className={cn(
            "animate-content-in fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
            "rounded-lg border border-border bg-card p-6 shadow-2xl shadow-foreground/10 focus:outline-none",
          )}
        >
          <AlertDialogPrimitive.Title className="text-base font-semibold text-foreground">
            {title}
          </AlertDialogPrimitive.Title>
          {description ? (
            <AlertDialogPrimitive.Description asChild>
              <div className="mt-1.5 text-sm text-muted-foreground">{description}</div>
            </AlertDialogPrimitive.Description>
          ) : null}
          {children}
          <div className="mt-6 flex items-center justify-end gap-2">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="secondary" disabled={isLoading}>
                {resolvedCancelLabel}
              </Button>
            </AlertDialogPrimitive.Cancel>
            <Button
              variant={variant}
              isLoading={isLoading}
              onClick={(event) => {
                event.preventDefault();
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
