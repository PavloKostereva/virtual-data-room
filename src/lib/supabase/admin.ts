import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readSupabasePublicEnv } from "@/lib/supabase/config";
import { AppError } from "@/server/errors";

/** Service-role client — never expose to the browser. Used to create confirmed users. */
export function createSupabaseAdminClient(): SupabaseClient {
  const { url } = readSupabasePublicEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new AppError(
      "INTERNAL",
      "Server is missing SUPABASE_SERVICE_ROLE_KEY. Add the Supabase Secret key in Vercel → Environment Variables, then redeploy.",
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
