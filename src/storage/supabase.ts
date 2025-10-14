import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./database.types.js";

let supabaseInstance: SupabaseClient<Database> | null = null;

/**
 * Set a mock Supabase instance for testing
 * @param mockInstance - Mock Supabase client
 */
export function setSupabaseMock(mockInstance: any) {
  supabaseInstance = mockInstance;
}

/**
 * Reset Supabase instance (useful for test cleanup)
 */
export function resetSupabase() {
  supabaseInstance = null;
}

/**
 * Get or create Supabase client instance (lazy initialization)
 * This ensures environment variables are loaded before client creation
 */
export function getSupabase(): SupabaseClient<Database> {
  console.log("[SUPABASE] getSupabase called, instance exists:", !!supabaseInstance);

  if (supabaseInstance) {
    console.log("[SUPABASE] Returning existing instance");
    return supabaseInstance;
  }

  console.log("[SUPABASE] Creating new instance...");
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  console.log("[SUPABASE] Environment check:", {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    urlPrefix: supabaseUrl?.substring(0, 20),
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[SUPABASE] Missing credentials!");
    throw new Error(
      "Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables."
    );
  }

  try {
    console.log("[SUPABASE] Calling createClient...");
    supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey);
    console.log("[SUPABASE] Client created successfully:", !!supabaseInstance);
    console.log("[SUPABASE] Client has .from method:", typeof supabaseInstance.from === "function");
    return supabaseInstance;
  } catch (err: any) {
    console.error("[SUPABASE] Error creating client:", err);
    console.error("[SUPABASE] Error stack:", err.stack);
    throw err;
  }
}
