import { Prisma } from "@prisma/client";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/server/db/prisma";
import { badRequest, conflict, unauthorized } from "@/server/errors";
import type { UserDto } from "@/types/dto";

const GENERIC_CREDENTIALS_ERROR = "That email or password is incorrect.";

function toUserDto(user: { id: string; email: string; name: string }): UserDto {
  return { id: user.id, email: user.email, name: user.name };
}

function readDisplayName(authUser: User, fallback: string): string {
  const metadata = authUser.user_metadata;
  if (metadata && typeof metadata === "object" && typeof metadata.name === "string") {
    const trimmed = metadata.name.trim();
    if (trimmed) return trimmed;
  }
  return fallback.trim();
}

export async function syncPrismaUser(authUser: User, preferredName?: string): Promise<UserDto> {
  if (!authUser.email) {
    throw badRequest("The authenticated account has no email address.");
  }

  const email = authUser.email.trim().toLowerCase();
  const name = preferredName?.trim() || readDisplayName(authUser, email.split("@")[0] ?? "User");

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  if (existing) {
    await prisma.shareGrant.updateMany({
      where: { email, userId: null },
      data: { userId: existing.id },
    });

    if (name !== existing.name) {
      const updated = await prisma.user.update({
        where: { email },
        data: { name },
        select: { id: true, email: true, name: true },
      });
      return toUserDto(updated);
    }

    return toUserDto(existing);
  }

  const user = await prisma.user.create({
    data: { id: authUser.id, email, name },
    select: { id: true, email: true, name: true },
  }).catch(async (error) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const clash = await prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true },
      });
      if (clash) return clash;
    }
    throw error;
  });

  return toUserDto(user);
}

function isAlreadyRegistered(message: string): boolean {
  const normalised = message.toLowerCase();
  return (
    normalised.includes("already registered") ||
    normalised.includes("already been registered") ||
    normalised.includes("user already exists") ||
    normalised.includes("email address is already")
  );
}

function mapAuthError(error: { message: string; status?: number }): never {
  const message = error.message.toLowerCase();

  if (message.includes("invalid login credentials") || message.includes("invalid email or password")) {
    throw unauthorized(GENERIC_CREDENTIALS_ERROR);
  }

  if (isAlreadyRegistered(error.message)) {
    throw conflict("An account with that email already exists.");
  }

  throw badRequest(error.message);
}

async function findAuthUserByEmail(email: string): Promise<User | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) mapAuthError(error);
  return data.users.find((user) => user.email?.toLowerCase() === email) ?? null;
}

export async function register(input: {
  email: string;
  password: string;
  name: string;
}): Promise<UserDto> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const admin = createSupabaseAdminClient();

  const created = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (!created.error && created.data.user) {
    return syncPrismaUser(created.data.user, name);
  }

  if (created.error && isAlreadyRegistered(created.error.message)) {
    const existing = await findAuthUserByEmail(email);
    if (!existing) throw conflict("An account with that email already exists.");
    if (existing.email_confirmed_at) {
      throw conflict("An account with that email already exists. Sign in instead.");
    }

    const updated = await admin.auth.admin.updateUserById(existing.id, {
      password: input.password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (updated.error) mapAuthError(updated.error);
    if (!updated.data.user) throw badRequest("The account could not be created.");
    return syncPrismaUser(updated.data.user, name);
  }

  if (created.error) mapAuthError(created.error);
  throw badRequest("The account could not be created.");
}

export async function login(
  supabase: SupabaseClient,
  input: { email: string; password: string },
): Promise<UserDto> {
  const email = input.email.trim().toLowerCase();

  let { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error && error.message.toLowerCase().includes("email not confirmed")) {
    const existing = await findAuthUserByEmail(email);
    if (existing) {
      const admin = createSupabaseAdminClient();
      const confirmed = await admin.auth.admin.updateUserById(existing.id, {
        email_confirm: true,
      });
      if (confirmed.error) mapAuthError(confirmed.error);

      const retry = await supabase.auth.signInWithPassword({
        email,
        password: input.password,
      });
      data = retry.data;
      error = retry.error;
    }
  }

  if (error) mapAuthError(error);
  if (!data.user) throw unauthorized(GENERIC_CREDENTIALS_ERROR);

  return syncPrismaUser(data.user);
}

export async function logout(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) mapAuthError(error);
}

export async function getCurrentUser(userId: string): Promise<UserDto | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  return user ? toUserDto(user) : null;
}

export async function getAppUser(): Promise<UserDto | null> {
  try {
    const { createServerContext } = await import("@/server/http/context");
    const context = await createServerContext();
    if (!context.user) return null;
    return {
      id: context.user.id,
      email: context.user.email,
      name: context.user.name,
    };
  } catch {
    return null;
  }
}
