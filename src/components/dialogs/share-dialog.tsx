"use client";

import { Check, Copy, Globe, Link2Off, Lock, Mail, UserMinus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { ErrorState, Skeleton } from "@/components/ui/feedback";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  useCreatePublicLink,
  useInviteRecipients,
  useRevokeGrant,
  useRevokeShare,
  useShares,
  type PublicLinkExpiry,
  type ShareInviteRole,
  type ShareSubject,
} from "@/hooks/use-shares";
import { ApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { emailSchema } from "@/lib/validation";
import type { ShareDto } from "@/types/dto";

interface ShareDialogProps {
  subject: ShareSubject | null;
  onOpenChange: (open: boolean) => void;
}

const SUBJECT_NOUN_KEYS: Record<string, "dataRoom" | "folder" | "file"> = {
  DATA_ROOM: "dataRoom",
  FOLDER: "folder",
  FILE: "file",
};

const EXPIRY_OPTIONS: Array<{ value: PublicLinkExpiry; label: string }> = [
  { value: null, label: "Never" },
  { value: 1, label: "1 day" },
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

const ROLE_OPTIONS: Array<{ value: ShareInviteRole; label: string; hint: string }> = [
  { value: "VIEWER", label: "Viewer", hint: "Can view only" },
  { value: "EDITOR", label: "Editor", hint: "Can upload, rename, move, delete" },
];

const selectClassName =
  "h-9 rounded-sm border border-input bg-card px-2 text-sm text-foreground shadow-xs focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25";

function roleLabel(role: string): string {
  return role === "EDITOR" ? "Editor" : "Viewer";
}

export function ShareDialog({ subject, onOpenChange }: ShareDialogProps) {
  const t = useTranslations("shareDialog");
  const shares = useShares(subject);
  const createLink = useCreatePublicLink(subject);
  const invite = useInviteRecipients(subject);
  const revokeShare = useRevokeShare(subject);
  const revokeGrant = useRevokeGrant(subject);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ShareInviteRole>("VIEWER");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<PublicLinkExpiry>(7);

  const publicShare = shares.data?.find((share) => share.mode === "PUBLIC_LINK") ?? null;
  const restrictedShare = shares.data?.find((share) => share.mode === "RESTRICTED") ?? null;
  const noun = subject
    ? t(SUBJECT_NOUN_KEYS[subject.type] ?? "item")
    : t("item");

  useEffect(() => {
    if (!subject) {
      setEmail("");
      setRole("VIEWER");
      setEmailError(null);
      setCopied(false);
      setExpiresInDays(7);
    }
  }, [subject]);

  const handleCopy = async (share: ShareDto) => {
    if (!share.url) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy the link. Select and copy it manually.");
    }
  };

  const handleInvite = (event: FormEvent) => {
    event.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }

    setEmailError(null);
    invite.mutate(
      { emails: [parsed.data], role },
      {
        onSuccess: () => {
          setEmail("");
          toast.success(
            `${parsed.data} can now ${role === "EDITOR" ? "edit" : "view"} this ${noun}`,
          );
        },
        onError: (error) =>
          setEmailError(error instanceof ApiError ? error.message : "The invite could not be sent."),
      },
    );
  };

  const handleChangeRole = (grantEmail: string, nextRole: ShareInviteRole) => {
    invite.mutate(
      { emails: [grantEmail], role: nextRole },
      {
        onSuccess: () =>
          toast.success(`${grantEmail} is now a ${roleLabel(nextRole).toLowerCase()}`),
        onError: (error) =>
          toast.error(error instanceof ApiError ? error.message : "Could not update access."),
      },
    );
  };

  return (
    <Dialog open={Boolean(subject)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader
          title={`Share “${subject?.name ?? ""}”`}
          description={`Invite people with Viewer or Editor access to this ${noun}${
            subject?.type === "FILE" ? "" : " and everything inside it"
          }. You can change or revoke access anytime.`}
        />

        {shares.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : shares.isError ? (
          <ErrorState
            message="Sharing settings could not be loaded."
            onRetry={() => void shares.refetch()}
            className="py-8"
          />
        ) : (
          <div className="space-y-5">
            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Mail className="size-4 text-muted-foreground" aria-hidden />
                Invite specific people
              </h3>

              <form onSubmit={handleInvite} className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="name@company.com"
                      aria-label="Email address"
                      aria-invalid={Boolean(emailError)}
                    />
                  </div>
                  <select
                    aria-label="Access level"
                    value={role}
                    onChange={(event) => setRole(event.target.value as ShareInviteRole)}
                    className={`${selectClassName} w-[7.5rem] shrink-0`}
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" isLoading={invite.isPending} disabled={email.length === 0}>
                    Invite
                  </Button>
                </div>
                {emailError ? (
                  <p role="alert" className="text-xs text-destructive">
                    {emailError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {ROLE_OPTIONS.find((option) => option.value === role)?.hint}
                  </p>
                )}
              </form>

              {restrictedShare && restrictedShare.grants.length > 0 ? (
                <ul className="divide-y divide-border rounded-sm border border-border">
                  {restrictedShare.grants.map((grant) => (
                    <li key={grant.id} className="flex items-center gap-2 px-3 py-2">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold uppercase text-accent-foreground">
                        {grant.email.slice(0, 2)}
                      </div>
                      <span className="min-w-0 flex-1 truncate text-sm">{grant.email}</span>
                      <select
                        aria-label={`Access level for ${grant.email}`}
                        value={grant.role === "EDITOR" ? "EDITOR" : "VIEWER"}
                        disabled={invite.isPending}
                        onChange={(event) =>
                          handleChangeRole(grant.email, event.target.value as ShareInviteRole)
                        }
                        className={`${selectClassName} w-[6.5rem] shrink-0`}
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="ghost"
                        size="iconSm"
                        aria-label={`Remove access for ${grant.email}`}
                        title="Remove access"
                        isLoading={revokeGrant.isPending}
                        onClick={() =>
                          revokeGrant.mutate(
                            { shareId: restrictedShare.id, grantId: grant.id },
                            {
                              onSuccess: () =>
                                toast.success(`Removed access for ${grant.email}`),
                            },
                          )
                        }
                      >
                        <UserMinus />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nobody has been invited yet. Invited people must sign in with that email address
                  to open the {noun}.
                </p>
              )}
            </section>

            <section className="space-y-3 border-t border-border pt-5">
              <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                {publicShare ? (
                  <Globe className="size-4 text-success" aria-hidden />
                ) : (
                  <Lock className="size-4 text-muted-foreground" aria-hidden />
                )}
                General access
              </h3>

              {publicShare?.url ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Anyone with this link can view this {noun}. No sign-in required.
                    {publicShare.expiresAt
                      ? ` Expires ${formatDateTime(publicShare.expiresAt)}.`
                      : " Never expires."}
                  </p>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={publicShare.url} onFocus={(e) => e.target.select()} />
                    <Button variant="secondary" onClick={() => void handleCopy(publicShare)}>
                      {copied ? <Check className="text-success" /> : <Copy />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    isLoading={revokeShare.isPending}
                    onClick={() =>
                      revokeShare.mutate(publicShare.id, {
                        onSuccess: () => toast.success("Link disabled. It no longer opens."),
                      })
                    }
                  >
                    <Link2Off />
                    Disable link
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 rounded-sm border border-border bg-muted/40 px-3 py-3">
                  <p className="text-xs text-muted-foreground">
                    Restricted — only invited people can open this {noun}. Create a link to share
                    with anyone who has the URL (view-only).
                  </p>
                  <Field
                    label="Link expires"
                    htmlFor="share-expiry"
                    hint="Due diligence links should not live forever."
                  >
                    <select
                      id="share-expiry"
                      value={expiresInDays ?? ""}
                      onChange={(event) => {
                        const raw = event.target.value;
                        setExpiresInDays(raw === "" ? null : (Number(raw) as 1 | 7 | 30 | 90));
                      }}
                      className={`${selectClassName} w-full px-3`}
                    >
                      {EXPIRY_OPTIONS.map((option) => (
                        <option key={String(option.value)} value={option.value ?? ""}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      isLoading={createLink.isPending}
                      onClick={() =>
                        createLink.mutate(expiresInDays, {
                          onSuccess: () => toast.success("Public link created"),
                        })
                      }
                    >
                      Create link
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
