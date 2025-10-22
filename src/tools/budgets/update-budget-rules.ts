import { z } from "zod";
import {
  getBudgetById,
  updateBudget,
} from "../../storage/budgets/budgets.js";
import { startBudgetProcessing } from "../../utils/budget-processing-worker.js";

// Input schema for update-budget-rules tool
export const UpdateBudgetRulesArgsSchema = z.object({
  id: z.string().describe("Budget ID to update"),
  title: z.string().optional().describe("Optional: Update display name for the budget"),
  filter_prompt: z.string().optional().describe("Optional: Update natural language filter criteria"),
  budget_amount: z.number().positive().optional().describe("Optional: Update dollar amount limit"),
  time_period: z.enum(["rolling", "weekly", "biweekly", "monthly", "quarterly", "yearly"]).optional().describe("Optional: Update budget type"),
  custom_period_days: z.number().int().positive().optional().describe("Optional: Update number of days for rolling budgets"),
  fixed_period_start_date: z.string().optional().describe("Optional: Update anchor date for fixed budgets (YYYY-MM-DD)"),
});

export type UpdateBudgetRulesArgs = z.infer<typeof UpdateBudgetRulesArgsSchema>;

/**
 * Update Budget Rules Tool Handler
 * Updates an existing budget's configuration and triggers re-processing
 */
export async function updateBudgetRulesHandler(
  userId: string,
  args: UpdateBudgetRulesArgs
) {
  // Check if budget exists
  const existingBudget = await getBudgetById(userId, args.id);

  if (!existingBudget) {
    return {
      content: [
        {
          type: "text" as const,
          text: `❌ **Budget Not Found**\n\nNo budget found with ID: ${args.id}\n\nUse "get-budgets" to see your available budgets.`,
        },
      ],
    };
  }

  // Merge updates with existing values
  const updatedFields = {
    title: args.title ?? existingBudget.title,
    filter_prompt: args.filter_prompt ?? existingBudget.filter_prompt,
    budget_amount: args.budget_amount ?? existingBudget.budget_amount,
    time_period: args.time_period ?? existingBudget.time_period,
    custom_period_days: args.custom_period_days !== undefined ? args.custom_period_days : existingBudget.custom_period_days,
    fixed_period_start_date: args.fixed_period_start_date !== undefined ? args.fixed_period_start_date : existingBudget.fixed_period_start_date,
  };

  // Validate rolling budgets have custom_period_days
  if (updatedFields.time_period === "rolling" && !updatedFields.custom_period_days) {
    return {
      content: [
        {
          type: "text" as const,
          text: "❌ **Error:** `custom_period_days` is required for rolling budgets (e.g., 7 for last 7 days, 30 for last 30 days)",
        },
      ],
    };
  }

  // Validate fixed budgets have fixed_period_start_date
  const fixedPeriods = ["weekly", "biweekly", "monthly", "quarterly", "yearly"];
  if (fixedPeriods.includes(updatedFields.time_period) && !updatedFields.fixed_period_start_date) {
    return {
      content: [
        {
          type: "text" as const,
          text: `❌ **Error:** \`fixed_period_start_date\` is required for ${updatedFields.time_period} budgets (e.g., '2025-01-15')`,
        },
      ],
    };
  }

  // Validate date format for fixed_period_start_date
  if (updatedFields.fixed_period_start_date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(updatedFields.fixed_period_start_date)) {
      return {
        content: [
          {
            type: "text" as const,
            text: "❌ **Error:** `fixed_period_start_date` must be in YYYY-MM-DD format (e.g., '2025-01-15')",
          },
        ],
      };
    }
  }

  // UPDATE existing budget
  const updated = await updateBudget(userId, args.id, {
    title: updatedFields.title,
    filter_prompt: updatedFields.filter_prompt,
    budget_amount: updatedFields.budget_amount,
    time_period: updatedFields.time_period,
    custom_period_days: updatedFields.custom_period_days,
    fixed_period_start_date: updatedFields.fixed_period_start_date,
    processing_status: "processing",
  });

  console.log(`[UPDATE-BUDGET-RULES] Updated budget ${updated.id}, starting async processing`);

  // Start background processing (non-blocking)
  startBudgetProcessing(userId, updated);

  return {
    content: [
      {
        type: "text" as const,
        text: `✅ **Budget Updated**\n\n**${updated.title}**\n- Amount: $${updated.budget_amount}\n- Period: ${updated.time_period}\n- Filter: ${updated.filter_prompt.substring(0, 100)}${updated.filter_prompt.length > 100 ? "..." : ""}\n\n⏳ **Processing in Progress**\n\nYour budget is being re-analyzed in the background. This typically takes **3-5 minutes** to match all your transactions.\n\nCheck back in a few minutes by saying "Show my budgets" to see the results!`,
      },
    ],
    structuredContent: {
      budgets: [
        {
          id: updated.id,
          title: updated.title,
          amount: updated.budget_amount,
          period: updated.time_period,
          customPeriodDays: updated.custom_period_days,
          spent: 0,
          remaining: updated.budget_amount,
          percentage: 0,
          status: "under" as const,
          processingStatus: "processing",
          transactionCount: 0,
        },
      ],
    },
    _meta: {
      "openai/outputTemplate": "ui://widget/budget-list.html",
      "openai/widgetAccessible": true,
      "openai/resultCanProduceWidget": true,
    },
    budgetId: updated.id,
  };
}
