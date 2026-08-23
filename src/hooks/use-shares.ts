"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, withQuery } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/keys";
import type { ShareDto, ShareSubjectType } from "@/types/dto";

export interface ShareSubject {
  type: ShareSubjectType;
  id: string;
  name: string;
}

export function useShares(subject: ShareSubject | null) {
  return useQuery({
    queryKey: queryKeys.shares(subject?.type ?? "DATA_ROOM", subject?.id ?? "none"),
    queryFn: () =>
      apiRequest<{ shares: ShareDto[] }>(
        withQuery("/api/shares", { subjectType: subject?.type, subjectId: subject?.id }),
      ).then((data) => data.shares),
    enabled: Boolean(subject),
  });
}

function useShareMutation<TVariables>(
  subject: ShareSubject | null,
  mutationFn: (variables: TVariables) => Promise<unknown>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.shares(subject?.type ?? "DATA_ROOM", subject?.id ?? "none"),
      }),
  });
}

export type PublicLinkExpiry = 1 | 7 | 30 | 90 | null;

export function useCreatePublicLink(subject: ShareSubject | null) {
  return useShareMutation(subject, (expiresInDays: PublicLinkExpiry = null) =>
    apiRequest<{ share: ShareDto }>("/api/shares", {
      method: "POST",
      body: {
        subjectType: subject?.type,
        subjectId: subject?.id,
        mode: "PUBLIC_LINK",
        expiresInDays,
      },
    }),
  );
}

export type ShareInviteRole = "VIEWER" | "EDITOR";

export function useInviteRecipients(subject: ShareSubject | null) {
  return useShareMutation(
    subject,
    (input: { emails: string[]; role?: ShareInviteRole }) =>
      apiRequest<{ share: ShareDto }>("/api/shares", {
        method: "POST",
        body: {
          subjectType: subject?.type,
          subjectId: subject?.id,
          mode: "RESTRICTED",
          emails: input.emails,
          role: input.role ?? "VIEWER",
        },
      }),
  );
}

export function useRevokeShare(subject: ShareSubject | null) {
  return useShareMutation(subject, (shareId: string) =>
    apiRequest<void>(`/api/shares/${shareId}`, { method: "DELETE" }),
  );
}

export function useRevokeGrant(subject: ShareSubject | null) {
  return useShareMutation(subject, (input: { shareId: string; grantId: string }) =>
    apiRequest<void>(`/api/shares/${input.shareId}/grants/${input.grantId}`, {
      method: "DELETE",
    }),
  );
}
