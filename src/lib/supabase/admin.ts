import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client. SUPABASE_SERVICE_ROLE_KEY bypasses Row Level Security,
 * so this file must only ever be imported from server-side code (API routes,
 * the GitHub Actions worker) — never from a client component.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
