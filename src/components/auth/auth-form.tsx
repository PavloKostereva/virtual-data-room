"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Vault } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useForgotPassword, useLogin, useRegister, useResetPassword } from "@/hooks/use-auth";
import { useFormatApiError } from "@/hooks/use-format-api-error";

export function LoginForm({
  justRegistered = false,
  justReset = false,
}: {
  justRegistered?: boolean;
  justReset?: boolean;
}) {
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

        <p className="-mt-2 text-right text-sm">
          <Link href="/forgot-password" className="font-medium text-primary hover:underline">
            {t("forgotPassword")}
          </Link>
        </p>

        {justRegistered && !login.error ? (
          <p
            role="status"
            className="rounded-sm border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground"
          >
            {t("accountCreated")}
          </p>
        ) : null}

        {justReset && !login.error && !justRegistered ? (
          <p
            role="status"
            className="rounded-sm border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground"
          >
            {t("passwordUpdated")}
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

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const tv = useTranslations("validation");
  const formatApiError = useFormatApiError();
  const requestReset = useForgotPassword();
  const resetPassword = useResetPassword();
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<"email" | "reset">("email");

  const emailSchema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .trim()
          .min(1, tv("emailRequired"))
          .email(tv("emailInvalid"))
          .transform((value) => value.toLowerCase()),
      }),
    [tv],
  );

  const resetSchema = useMemo(
    () =>
      z
        .object({
          email: z
            .string()
            .trim()
            .min(1, tv("emailRequired"))
            .email(tv("emailInvalid"))
            .transform((value) => value.toLowerCase()),
          code: z
            .string()
            .trim()
            .regex(/^\d{6}$/, tv.has("codeInvalid") ? tv("codeInvalid") : "Enter a 6-digit code."),
          password: z.string().min(8, tv("passwordMin")).max(128, tv("passwordMax")),
          confirmPassword: z.string().min(8, tv("passwordMin")),
        })
        .refine((value) => value.password === value.confirmPassword, {
          message: tv.has("passwordsMustMatch")
            ? tv("passwordsMustMatch")
            : "Passwords do not match.",
          path: ["confirmPassword"],
        }),
    [tv],
  );

  type EmailInput = z.infer<typeof emailSchema>;
  type ResetInput = z.infer<typeof resetSchema>;

  const emailForm = useForm<EmailInput>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  const resetForm = useForm<ResetInput>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: "", code: "", password: "", confirmPassword: "" },
  });

  const email = emailForm.watch("email") || resetForm.watch("email");

  return (
    <AuthCard
      title={t("forgotTitle")}
      subtitle={t("forgotSubtitle")}
      footer={
        <>
          {t("hasAccount")}{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("signIn")}
          </Link>
        </>
      }
    >
      {step === "email" ? (
        <form
          noValidate
          className="space-y-4"
          onSubmit={emailForm.handleSubmit((values) => {
            requestReset.mutate(values, {
              onSuccess: (result) => {
                setIssuedCode(result.code ?? null);
                setCopied(false);
                resetForm.reset({
                  email: values.email,
                  code: result.code ?? "",
                  password: "",
                  confirmPassword: "",
                });
                setStep("reset");
              },
            });
          })}
        >
          <Field
            label={t("email")}
            htmlFor="forgot-email"
            error={emailForm.formState.errors.email?.message}
          >
            <Input
              id="forgot-email"
              type="email"
              autoComplete="email"
              autoFocus
              aria-invalid={Boolean(emailForm.formState.errors.email)}
              {...emailForm.register("email")}
            />
          </Field>

          <FormError error={requestReset.error} formatApiError={formatApiError} />

          <Button type="submit" className="w-full" isLoading={requestReset.isPending}>
            {t("sendCode")}
          </Button>
        </form>
      ) : (
        <form
          noValidate
          className="space-y-4"
          onSubmit={resetForm.handleSubmit((values) => {
            resetPassword.mutate({
              email: values.email,
              code: values.code,
              password: values.password,
            });
          })}
        >
          <p role="status" className="text-sm text-muted-foreground">
            {t("codeSent")}
          </p>

          {issuedCode ? (
            <div className="rounded-sm border border-primary/20 bg-primary/5 px-3 py-3">
              <p className="text-xs text-muted-foreground">{t("demoCodeHint")}</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="font-mono text-lg tracking-[0.35em] text-foreground">{issuedCode}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(issuedCode);
                    setCopied(true);
                  }}
                >
                  {copied ? t("copiedCode") : t("copyCode")}
                </Button>
              </div>
            </div>
          ) : null}

          <Field
            label={t("email")}
            htmlFor="reset-email"
            error={resetForm.formState.errors.email?.message}
          >
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(resetForm.formState.errors.email)}
              {...resetForm.register("email")}
            />
          </Field>

          <Field
            label={t("code")}
            htmlFor="reset-code"
            error={resetForm.formState.errors.code?.message}
          >
            <Input
              id="reset-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={6}
              aria-invalid={Boolean(resetForm.formState.errors.code)}
              {...resetForm.register("code")}
            />
          </Field>

          <Field
            label={t("newPassword")}
            htmlFor="reset-password"
            hint={t("passwordHint")}
            error={resetForm.formState.errors.password?.message}
          >
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(resetForm.formState.errors.password)}
              {...resetForm.register("password")}
            />
          </Field>

          <Field
            label={t("confirmPassword")}
            htmlFor="reset-confirm"
            error={resetForm.formState.errors.confirmPassword?.message}
          >
            <Input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(resetForm.formState.errors.confirmPassword)}
              {...resetForm.register("confirmPassword")}
            />
          </Field>

          <FormError error={resetPassword.error} formatApiError={formatApiError} />

          <Button type="submit" className="w-full" isLoading={resetPassword.isPending}>
            {t("resetPassword")}
          </Button>

          <button
            type="button"
            className="w-full text-center text-sm font-medium text-primary hover:underline"
            onClick={() => {
              setStep("email");
              emailForm.reset({ email });
              requestReset.reset();
              resetPassword.reset();
            }}
          >
            {t("useDifferentEmail")}
          </button>
        </form>
      )}
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
