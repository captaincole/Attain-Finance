import { z } from "zod";
import crypto from "crypto";
import {
  getBudgetById,
  createBudget,
  updateBudget,
} from "../../storage/budgets/budgets.js";

// Input schema for upsert-budget tool
export const UpsertBudgetArgsSchema = z.object({
  id: z.string().optional().describe("Optional: Budget ID to update. If omitted or doesn't exist, creates new budget."),
  title: z.string().describe("Display name for the budget (e.g., 'Coffee Shop Budget')"),
  filter_prompt: z.string().describe("Natural language filter criteria describing which transactions to include"),
  budget_amount: z.number().positive().describe("Dollar amount limit for the budget"),
  time_period: z.enum(["daily", "weekly", "monthly", "custom"]).describe("Time period for budget tracking"),
  custom_period_days: z.number().int().positive().optional().describe("Number of days for custom period (required if time_period is 'custom')"),
});

export type UpsertBudgetArgs = z.infer<typeof UpsertBudgetArgsSchema>;

/**
 * Upsert Budget Tool Handler
 * Creates a new budget or updates an existing one
 */
export async function upsertBudgetHandler(
  userId: string,
  args: UpsertBudgetArgs
) {
  // Validate custom_period_days is provided when time_period is 'custom'
  if (args.time_period === "custom" && !args.custom_period_days) {
    return {
      content: [
        {
          type: "text" as const,
          text: "❌ **Error:** `custom_period_days` is required when `time_period` is 'custom'",
        },
      ],
    };
  }

  // If ID provided, check if budget exists
  if (args.id) {
    const existingBudget = await getBudgetById(userId, args.id);

    if (existingBudget) {
      // UPDATE existing budget
      const updated = await updateBudget(userId, args.id, {
        title: args.title,
        filter_prompt: args.filter_prompt,
        budget_amount: args.budget_amount,
        time_period: args.time_period,
        custom_period_days: args.custom_period_days || null,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `✅ **Budget Updated**\n\n**${updated.title}**\n- Amount: $${updated.budget_amount}\n- Period: ${updated.time_period}\n- Filter: ${updated.filter_prompt.substring(0, 100)}${updated.filter_prompt.length > 100 ? "..." : ""}\n\nUse \`get-budgets\` to see current spending status.`,
          },
        ],
        budgetId: updated.id,
      };
    }
  }

  // CREATE new budget (either no ID provided, or ID doesn't exist)
  const newId = crypto.randomUUID();
  const created = await createBudget({
    id: newId,
    user_id: userId,
    title: args.title,
    filter_prompt: args.filter_prompt,
    budget_amount: args.budget_amount,
    time_period: args.time_period,
    custom_period_days: args.custom_period_days || null,
  });

  return {
    content: [
      {
        type: "text" as const,
        text: `✅ **Budget Created**\n\n**${created.title}**\n- Amount: $${created.budget_amount}\n- Period: ${created.time_period}\n- Filter: ${created.filter_prompt.substring(0, 100)}${created.filter_prompt.length > 100 ? "..." : ""}\n\nUse \`get-budgets\` to see current spending status.`,
      },
    ],
    budgetId: created.id,
  };
}
