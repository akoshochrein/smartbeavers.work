import { createClient } from "@supabase/supabase-js";
import type { Database } from "../shared/database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY — copy .env.example to .env.local");
}

export const supabase = createClient<Database>(url, key, {
  auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
});

export type Colony = Database["public"]["Tables"]["colonies"]["Row"];
export type AdapterState = Database["public"]["Tables"]["adapter_states"]["Row"];
export type AdapterEvent = Database["public"]["Tables"]["adapter_events"]["Row"];
