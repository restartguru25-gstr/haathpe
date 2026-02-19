import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Auth and data will be unavailable."
  );
}

export const supabase = createClient<Database>(supabaseUrl || "", supabaseAnonKey || "");

/** Creates a fresh Supabase client to avoid shared auth lock state (navigator.locks) that can cause AbortError during inserts. */
export function createFreshSupabaseClient() {
  return createClient<Database>(supabaseUrl || "", supabaseAnonKey || "");
}
