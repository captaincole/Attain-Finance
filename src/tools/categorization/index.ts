/**
 * Categorization Tools Registry
 * AI-powered transaction categorization rules
 */

import { z } from "zod";
import { updateCategorizationRulesHandler } from "./update-rules.js";
import { getSupabaseForUser } from "../../storage/supabase.js";
import type { ToolDefinition } from "../types.js";

export function getCategorizationTools(): ToolDefinition[] {
  return [
    {
      name: "update-categorization-rules",
      description: "Update global transaction categorization rules that apply to ALL transactions (e.g., 'Categorize all Amazon Prime as Business expenses'). This updates the general category field for transactions but does NOT affect budget matching. To update which transactions match a specific budget, use 'update-budget-rules' instead. After updating, all transactions will be automatically re-categorized with the new rules in the background.",
      inputSchema: {
        rules: z
          .string()
          .describe("Custom categorization instructions (e.g., 'Categorize all Amazon Prime as Business expenses', 'Put Starbucks in Personal Care instead of Food & Dining')"),
      },
      options: {
        securitySchemes: [{ type: "oauth2" }],
      },
      handler: async (args, { authInfo }) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        const supabaseClient = getSupabaseForUser(userId);
        return updateCategorizationRulesHandler(userId, args, supabaseClient);
      },
    },
  ];
}
