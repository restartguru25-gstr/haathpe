import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Auth and data will be unavailable."
  );
}

let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null;

/** Single Supabase client instance — avoids "Multiple GoTrueClient instances" warning. */
export function getSupabase() {
  if (!supabaseInstance) {
    supabaseInstance = createClient<Database>(supabaseUrl || "", supabaseAnonKey || "", {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== "undefined" ? window.localStorage : undefined,
      },
    });
  }
  return supabaseInstance;
}

/** Shared Supabase client — use this everywhere instead of creating new clients. */
export const supabase = getSupabase();
