import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getSupabase } from "../supabase.js";
import { Tables } from "../database.types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database type for user_visualizations table
 */
export type UserVisualization = Tables<"user_visualizations">;

/**
 * Load the default visualization script
 */
export function getDefaultVisualization(): string {
  const scriptPath = path.join(__dirname, "../../public/visualize-spending.sh");
  return fs.readFileSync(scriptPath, "utf-8");
}

/**
 * Get user's custom visualization script
 * @param userId - Clerk user ID
 * @returns Custom script or null if user hasn't customized it
 */
export async function getUserVisualization(userId: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from("user_visualizations")
    .select("script_content")
    .eq("user_id", userId)
    .single();

  if (error) {
    // User doesn't have a custom visualization yet - this is normal
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching user visualization:", error);
    throw new Error(`Failed to fetch visualization: ${error.message}`);
  }

  return data?.script_content || null;
}

/**
 * Get visualization script (custom or default)
 * @param userId - Clerk user ID
 * @returns User's custom script if available, otherwise default script
 */
export async function getVisualization(userId: string): Promise<string> {
  const customScript = await getUserVisualization(userId);
  if (customScript) {
    return customScript;
  }
  return getDefaultVisualization();
}

/**
 * Save or update user's custom visualization script
 * @param userId - Clerk user ID
 * @param scriptContent - Bash script content
 */
export async function saveVisualization(
  userId: string,
  scriptContent: string
): Promise<void> {
  const { error } = await getSupabase()
    .from("user_visualizations")
    .upsert(
      {
        user_id: userId,
        script_content: scriptContent,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

  if (error) {
    console.error("Error saving visualization:", error);
    throw new Error(`Failed to save visualization: ${error.message}`);
  }

  console.log(`✓ Saved custom visualization for user ${userId}`);
}

/**
 * Reset user's visualization to default
 * @param userId - Clerk user ID
 */
export async function resetVisualization(userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("user_visualizations")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting visualization:", error);
    throw new Error(`Failed to reset visualization: ${error.message}`);
  }

  console.log(`✓ Reset visualization to default for user ${userId}`);
}
