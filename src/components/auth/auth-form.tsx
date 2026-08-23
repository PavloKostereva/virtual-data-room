"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Vault } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useLogin, useRegister } from "@/hooks/use-auth";
import { useFormatApiError } from "@/hooks/use-format-api-error";

export function LoginForm({ justRegistered = false }: { justRegistered?: boolean }) {
  const t = useTranslations("auth");
  const tv = useTranslations("validation");
  const formatApiError = useFormatApiError();
  const login = useLogin();

  const loginSchema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .trim()
          .min(1, tv("emailRequired"))
          .email(tv("emailInvalid"))
          .transform((value) => value.toLowerCase()),
        password: z.string().min(1, tv("passwordRequired")),
      }),
    [tv],
  );

  type LoginInput = z.infer<typeof loginSchema>;

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  return (
    <AuthCard
      title={t("signInTitle")}
      subtitle={t("signInSubtitle")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            {t("createOne")}
          </Link>
        </>
      }
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => login.mutate(values))}
      >
        <Field label={t("email")} htmlFor="email" error={form.formState.errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register("email")}
          />
        </Field>

        <Field
          label={t("password")}
          htmlFor="password"
          error={form.formState.errors.password?.message}
        >
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register("password")}
          />
        </Field>

        {justRegistered && !login.error ? (
          <p
            role="status"
            className="rounded-sm border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground"
          >
            {t("accountCreated")}
          </p>
        ) : null}

        <FormError error={login.error} formatApiError={formatApiError} />

        <Button type="submit" className="w-full" isLoading={login.isPending}>
          {t("signIn")}
        </Button>
      </form>
    </AuthCard>
  );
}

export function RegisterForm() {
  const t = useTranslations("auth");
  const tv = useTranslations("validation");
  const formatApiError = useFormatApiError();
  const register = useRegister();

  const registerSchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, tv("nameRequired")).max(80, tv("nameTooLong")),
        email: z
          .string()
          .trim()
          .min(1, tv("emailRequired"))
          .email(tv("emailInvalid"))
          .transform((value) => value.toLowerCase()),
        password: z
          .string()
          .min(8, tv("passwordMin"))
          .max(128, tv("passwordMax")),
      }),
    [tv],
  );

  type RegisterInput = z.infer<typeof registerSchema>;

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  return (
    <AuthCard
      title={t("createAccountTitle")}
      subtitle={t("createAccountSubtitle")}
      footer={
        <>
          {t("hasAccount")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("signIn")}
          </Link>
        </>
      }
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => register.mutate(values))}
      >
        <Field label={t("fullName")} htmlFor="name" error={form.formState.errors.name?.message}>
          <Input
            id="name"
            autoComplete="name"
            autoFocus
            aria-invalid={Boolean(form.formState.errors.name)}
            {...form.register("name")}
          />
        </Field>

        <Field
          label={t("workEmail")}
          htmlFor="email"
          error={form.formState.errors.email?.message}
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register("email")}
          />
        </Field>

        <Field
          label={t("password")}
          htmlFor="password"
          hint={t("passwordHint")}
          error={form.formState.errors.password?.message}
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register("password")}
          />
        </Field>

        <FormError error={register.error} formatApiError={formatApiError} />

        <Button type="submit" className="w-full" isLoading={register.isPending}>
          {t("createAccount")}
        </Button>
      </form>
    </AuthCard>
  );
}

function FormError({
  error,
  formatApiError,
}: {
  error: unknown;
  formatApiError: (error: unknown) => string;
}) {
  if (!error) return null;

  return (
    <p
      role="alert"
      className="rounded-sm border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      {formatApiError(error)}
    </p>
  );
}

function AuthCard({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Vault className="size-5" aria-hidden />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">{children}</div>

        <p className="mt-5 text-center text-sm text-muted-foreground">{footer}</p>
      </div>
    </div>
  );
}
