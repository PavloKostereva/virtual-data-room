import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/server/db/prisma";

export interface SessionPayload {
  userId: string;
  email: string;
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) return null;

    const email = user.email.toLowerCase();
    const dbUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    return {
      userId: dbUser?.id ?? user.id,
      email,
    };
  } catch {
    return null;
  }
}
