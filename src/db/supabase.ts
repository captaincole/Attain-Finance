import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./database.types.js";

let supabaseInstance: SupabaseClient<Database> | null = null;

/**
 * Get or create Supabase client instance (lazy initialization)
 * This ensures environment variables are loaded before client creation
 */
export function getSupabase(): SupabaseClient<Database> {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables."
    );
  }

  supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
}
