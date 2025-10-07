import { getSupabase } from "./supabase.js";
import { Tables } from "./database.types.js";

/**
 * Database type for categorization_prompts table
 */
export type CategorizationPrompt = Tables<"categorization_prompts">;

/**
 * Get user's custom categorization rules
 * @param userId - Clerk user ID
 * @returns Custom rules text or null if not set
 */
export async function getCustomRules(userId: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("categorization_prompts")
    .select("custom_rules")
    .eq("user_id", userId)
    .single();

  if (error) {
    // User doesn't have custom rules yet - this is normal
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching categorization rules:", error);
    throw new Error(`Failed to fetch categorization rules: ${error.message}`);
  }

  return data?.custom_rules || null;
}

/**
 * Save or update user's custom categorization rules
 * @param userId - Clerk user ID
 * @param customRules - Custom categorization instructions
 */
export async function saveCustomRules(
  userId: string,
  customRules: string
): Promise<void> {
  const { error } = await getSupabase()
    .from("categorization_prompts")
    .upsert(
      {
        user_id: userId,
        custom_rules: customRules,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

  if (error) {
    console.error("Error saving categorization rules:", error);
    throw new Error(`Failed to save categorization rules: ${error.message}`);
  }

  console.log(`✓ Saved categorization rules for user ${userId}`);
}

/**
 * Delete user's custom categorization rules (reset to defaults)
 * @param userId - Clerk user ID
 */
export async function deleteCustomRules(userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("categorization_prompts")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting categorization rules:", error);
    throw new Error(`Failed to delete categorization rules: ${error.message}`);
  }

  console.log(`✓ Deleted categorization rules for user ${userId}`);
}
