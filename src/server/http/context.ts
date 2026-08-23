import type { User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { cache } from "react";
import { createSupabaseRouteClient } from "@/lib/supabase/route";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/server/db/prisma";
import { unauthorized } from "@/server/errors";
import { syncPrismaUser } from "@/server/services/auth.service";

export const SHARE_TOKEN_HEADER = "x-share-token";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

export interface RequestContext {
  user: AuthenticatedUser | null;
  shareToken: string | null;
}

/**
 * Resolve the Supabase Auth user once per RSC request.
 * Prefers getClaims() (local JWT verify) over getUser() (Auth network hop).
 */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (!claimsError && claimsData?.claims) {
    const claims = claimsData.claims as Record<string, unknown>;
    const email =
      typeof claims.email === "string"
        ? claims.email
        : typeof (claims.user_metadata as { email?: string } | undefined)?.email === "string"
          ? (claims.user_metadata as { email: string }).email
          : null;
    const sub = typeof claims.sub === "string" ? claims.sub : null;
    if (email && sub) {
      return {
        id: sub,
        email,
        app_metadata: (claims.app_metadata as User["app_metadata"]) ?? {},
        user_metadata: (claims.user_metadata as User["user_metadata"]) ?? {},
        aud: typeof claims.aud === "string" ? claims.aud : "authenticated",
        created_at: "",
      } as User;
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

async function resolveAppUser(authUser: User | null): Promise<AuthenticatedUser | null> {
  if (!authUser?.email) return null;

  const email = authUser.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });
  if (existing) return existing;

  const appUser = await syncPrismaUser(authUser);
  return { id: appUser.id, email: appUser.email, name: appUser.name };
}

/** Cached per RSC request — layout + page share one Auth + one Prisma lookup. */
export const createServerContext = cache(
  async (shareToken: string | null = null): Promise<RequestContext> => {
    const authUser = await getAuthUser();
    return {
      user: await resolveAppUser(authUser),
      shareToken: shareToken && shareToken.length > 0 ? shareToken : null,
    };
  },
);

export async function createRequestContext(request: NextRequest): Promise<RequestContext> {
  const { supabase } = createSupabaseRouteClient(request);

  const shareToken =
    request.headers.get(SHARE_TOKEN_HEADER) ??
    request.nextUrl.searchParams.get("shareToken") ??
    null;

  let authUser: User | null = null;
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (!claimsError && claimsData?.claims) {
    const claims = claimsData.claims as Record<string, unknown>;
    const email = typeof claims.email === "string" ? claims.email : null;
    const sub = typeof claims.sub === "string" ? claims.sub : null;
    if (email && sub) {
      authUser = {
        id: sub,
        email,
        app_metadata: (claims.app_metadata as User["app_metadata"]) ?? {},
        user_metadata: (claims.user_metadata as User["user_metadata"]) ?? {},
        aud: typeof claims.aud === "string" ? claims.aud : "authenticated",
        created_at: "",
      } as User;
    }
  }
  if (!authUser) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authUser = user;
  }

  return {
    user: await resolveAppUser(authUser),
    shareToken: shareToken && shareToken.length > 0 ? shareToken : null,
  };
}

export function requireUser(context: RequestContext): AuthenticatedUser {
  if (!context.user) throw unauthorized();
  return context.user;
}
