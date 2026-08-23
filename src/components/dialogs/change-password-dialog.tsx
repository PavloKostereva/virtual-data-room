"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useChangePassword } from "@/hooks/use-auth";
import { useFormatApiError } from "@/hooks/use-format-api-error";

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("auth");
  const tv = useTranslations("validation");
  const tc = useTranslations("common");
  const formatApiError = useFormatApiError();
  const changePassword = useChangePassword();

  const schema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, tv("passwordRequired")),
          newPassword: z.string().min(8, tv("passwordMin")).max(128, tv("passwordMax")),
          confirmPassword: z.string().min(8, tv("passwordMin")),
        })
        .refine((value) => value.newPassword === value.confirmPassword, {
          message: tv.has("passwordsMustMatch")
            ? tv("passwordsMustMatch")
            : "Passwords do not match.",
          path: ["confirmPassword"],
        })
        .refine((value) => value.currentPassword !== value.newPassword, {
          message: tv.has("passwordMustDiffer")
            ? tv("passwordMustDiffer")
            : "Choose a password that is different from the current one.",
          path: ["newPassword"],
        }),
    [tv],
  );

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader title={t("changePasswordTitle")} description={t("changePasswordHint")} />
        <form
          noValidate
          onSubmit={form.handleSubmit((values) => {
            changePassword.mutate(
              { currentPassword: values.currentPassword, newPassword: values.newPassword },
              {
                onSuccess: () => {
                  toast.success(t("passwordChanged"));
                  onOpenChange(false);
                },
              },
            );
          })}
        >
          <div className="space-y-4">
            <Field
              label={t("currentPassword")}
              htmlFor="current-password"
              error={form.formState.errors.currentPassword?.message}
            >
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                aria-invalid={Boolean(form.formState.errors.currentPassword)}
                {...form.register("currentPassword")}
              />
            </Field>

            <Field
              label={t("newPassword")}
              htmlFor="new-password"
              hint={t("passwordHint")}
              error={form.formState.errors.newPassword?.message}
            >
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(form.formState.errors.newPassword)}
                {...form.register("newPassword")}
              />
            </Field>

            <Field
              label={t("confirmPassword")}
              htmlFor="confirm-password"
              error={form.formState.errors.confirmPassword?.message}
            >
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(form.formState.errors.confirmPassword)}
                {...form.register("confirmPassword")}
              />
            </Field>

            {changePassword.error ? (
              <p
                role="alert"
                className="rounded-sm border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {formatApiError(changePassword.error)}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" isLoading={changePassword.isPending}>
              {t("changePassword")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
