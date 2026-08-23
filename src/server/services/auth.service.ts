import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { prisma } from "@/server/db/prisma";
import { badRequest, conflict, unauthorized } from "@/server/errors";
import type { UserDto } from "@/types/dto";

const DEMO_ACCOUNT_EMAILS = new Set(["demo@vault.app", "guest@vault.app"]);
const RESET_TTL_MS = 15 * 60 * 1000;
const MAX_RESET_ATTEMPTS = 5;
const GENERIC_RESET_ERROR = "That reset code is invalid or has expired.";
const DEMO_ACCOUNT_ERROR =
  "The demo accounts can't be reset. Sign in with demo1234, or register your own account.";

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
  const normalised = email.trim().toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) mapAuthError(error);
    const match = data.users.find((user) => user.email?.toLowerCase() === normalised);
    if (match) return match;
    if (data.users.length < 200) return null;
  }

  return null;
}

/** Prisma User.id can be a legacy cuid, while Auth uses a UUID. Always resolve Auth by email. */
async function resolveAuthUserId(email: string, prismaUserId?: string): Promise<string> {
  if (prismaUserId) {
    const admin = createSupabaseAdminClient();
    const byId = await admin.auth.admin.getUserById(prismaUserId);
    if (!byId.error && byId.data.user) return byId.data.user.id;
  }

  const byEmail = await findAuthUserByEmail(email);
  if (byEmail) return byEmail.id;

  throw badRequest(GENERIC_RESET_ERROR);
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

function assertNotDemoAccount(email: string) {
  if (DEMO_ACCOUNT_EMAILS.has(email)) {
    throw badRequest(DEMO_ACCOUNT_ERROR);
  }
}

function hashResetCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateResetCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function resetCodesMatch(storedHash: string, code: string): boolean {
  const incoming = Buffer.from(hashResetCode(code), "utf8");
  const stored = Buffer.from(storedHash, "utf8");
  if (incoming.length !== stored.length) return false;
  return timingSafeEqual(incoming, stored);
}

async function clearPasswordReset(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordResetHash: null,
      passwordResetExpiresAt: null,
      passwordResetAttempts: 0,
    },
  });
}

export async function requestPasswordReset(
  email: string,
): Promise<{ ok: true; code?: string }> {
  const normalised = email.trim().toLowerCase();
  assertNotDemoAccount(normalised);

  const user = await prisma.user.findUnique({
    where: { email: normalised },
    select: { id: true },
  });

  if (!user) return { ok: true };

  const code = generateResetCode();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetHash: hashResetCode(code),
      passwordResetExpiresAt: new Date(Date.now() + RESET_TTL_MS),
      passwordResetAttempts: 0,
    },
  });

  return { ok: true, code };
}

export async function resetPassword(input: {
  email: string;
  code: string;
  password: string;
}): Promise<{ ok: true }> {
  const email = input.email.trim().toLowerCase();
  assertNotDemoAccount(email);

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      passwordResetHash: true,
      passwordResetExpiresAt: true,
      passwordResetAttempts: true,
    },
  });

  if (
    !user?.passwordResetHash ||
    !user.passwordResetExpiresAt ||
    user.passwordResetExpiresAt.getTime() < Date.now() ||
    user.passwordResetAttempts >= MAX_RESET_ATTEMPTS
  ) {
    if (user && user.passwordResetAttempts >= MAX_RESET_ATTEMPTS) {
      await clearPasswordReset(user.id);
    }
    throw badRequest(GENERIC_RESET_ERROR);
  }

  if (!resetCodesMatch(user.passwordResetHash, input.code.trim())) {
    const attempts = user.passwordResetAttempts + 1;
    if (attempts >= MAX_RESET_ATTEMPTS) {
      await clearPasswordReset(user.id);
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetAttempts: attempts },
      });
    }
    throw badRequest(GENERIC_RESET_ERROR);
  }

  const authUserId = await resolveAuthUserId(email, user.id);
  const admin = createSupabaseAdminClient();
  const updated = await admin.auth.admin.updateUserById(authUserId, {
    password: input.password,
  });
  if (updated.error) {
    const message = updated.error.message.toLowerCase();
    if (message.includes("user not found")) throw badRequest(GENERIC_RESET_ERROR);
    mapAuthError(updated.error);
  }

  await clearPasswordReset(user.id);
  return { ok: true };
}

export async function changePassword(
  supabase: SupabaseClient,
  user: { id: string; email: string },
  input: { currentPassword: string; newPassword: string },
): Promise<{ ok: true }> {
  assertNotDemoAccount(user.email);

  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: input.currentPassword,
  });
  if (error) throw unauthorized("Current password is incorrect.");

  const authUserId = await resolveAuthUserId(user.email, user.id);
  const admin = createSupabaseAdminClient();
  const updated = await admin.auth.admin.updateUserById(authUserId, {
    password: input.newPassword,
  });
  if (updated.error) mapAuthError(updated.error);

  await clearPasswordReset(user.id);
  return { ok: true };
}
