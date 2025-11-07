import { withUserSupabaseRetry } from "../supabase.js";
import { Tables } from "../database.types.js";
import { logServiceEvent, serializeError } from "../../utils/logger.js";

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
  return withUserSupabaseRetry(userId, async (client) => {
    const { data, error } = await client
      .from("categorization_prompts")
      .select("custom_rules")
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }

      logServiceEvent("categorization-rules", "fetch-error", { userId, error: serializeError(error) }, "error");
      throw new Error(`Failed to fetch categorization rules: ${error.message}`);
    }

    return data?.custom_rules || null;
  });
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
  await withUserSupabaseRetry(userId, async (client) => {
    const { error } = await client
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
      logServiceEvent("categorization-rules", "save-error", { userId, error: serializeError(error) }, "error");
      throw new Error(`Failed to save categorization rules: ${error.message}`);
    }
  });

  logServiceEvent("categorization-rules", "saved", { userId });
}

/**
 * Delete user's custom categorization rules (reset to defaults)
 * @param userId - Clerk user ID
 */
export async function deleteCustomRules(userId: string): Promise<void> {
  await withUserSupabaseRetry(userId, async (client) => {
    const { error } = await client
      .from("categorization_prompts")
      .delete()
      .eq("user_id", userId);

    if (error) {
      logServiceEvent("categorization-rules", "delete-error", { userId, error: serializeError(error) }, "error");
      throw new Error(`Failed to delete categorization rules: ${error.message}`);
    }
  });

  logServiceEvent("categorization-rules", "deleted", { userId });
}
