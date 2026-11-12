import { createClient } from "@supabase/supabase-js";
import { env } from "cloudflare:workers";
import type { Database } from "@/shared/database.types";

/**
 * Supabase client with the secret key. Server routes only: it bypasses row level security,
 * so every caller must check for itself what the request is allowed to do.
 * Env comes from wrangler.jsonc + .dev.vars (types: `pnpm cf-typegen`).
 */
export const adminClient = () =>
  createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export const json = (body: unknown, status: number) => Response.json(body, { status });
