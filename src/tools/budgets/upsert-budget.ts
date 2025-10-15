import { z } from "zod";
import crypto from "crypto";
import {
  getBudgetById,
  createBudget,
  updateBudget,
} from "../../storage/budgets/budgets.js";
import { startBudgetProcessing } from "../../utils/budget-processing-worker.js";

// Input schema for upsert-budget tool
export const UpsertBudgetArgsSchema = z.object({
  id: z.string().optional().describe("Optional: Budget ID to update. If omitted or doesn't exist, creates new budget."),
  title: z.string().describe("Display name for the budget (e.g., 'Coffee Shop Budget')"),
  filter_prompt: z.string().describe("Natural language filter criteria describing which transactions to include"),
  budget_amount: z.number().positive().describe("Dollar amount limit for the budget"),
  time_period: z.enum(["rolling", "weekly", "biweekly", "monthly", "quarterly", "yearly"]).describe("Budget type: 'rolling' for last N days, or fixed periods (weekly/biweekly/monthly/quarterly/yearly)"),
  custom_period_days: z.number().int().positive().optional().describe("Required for 'rolling' budgets: number of days to track (e.g., 7, 30, 90)"),
  fixed_period_start_date: z.string().optional().describe("Required for fixed budgets: anchor date in YYYY-MM-DD format (e.g., '2025-01-15' for monthly budget starting on 15th)"),
});

export type UpsertBudgetArgs = z.infer<typeof UpsertBudgetArgsSchema>;

/**
 * Upsert Budget Tool Handler
 * Creates a new budget or updates an existing one, then triggers transaction labeling
 */
export async function upsertBudgetHandler(
  userId: string,
  args: UpsertBudgetArgs
) {
  // Validate rolling budgets have custom_period_days
  if (args.time_period === "rolling" && !args.custom_period_days) {
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
  if (fixedPeriods.includes(args.time_period) && !args.fixed_period_start_date) {
    return {
      content: [
        {
          type: "text" as const,
          text: `❌ **Error:** \`fixed_period_start_date\` is required for ${args.time_period} budgets (e.g., '2025-01-15')`,
        },
      ],
    };
  }

  // Validate date format for fixed_period_start_date
  if (args.fixed_period_start_date) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(args.fixed_period_start_date)) {
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
        fixed_period_start_date: args.fixed_period_start_date || null,
        processing_status: "processing",
      });

      console.log(`[UPSERT-BUDGET] Updated budget ${updated.id}, starting async processing`);

      // Start background processing (non-blocking)
      startBudgetProcessing(userId, updated);

      return {
        content: [
          {
            type: "text" as const,
            text: `✅ **Budget Updated**\n\n**${updated.title}**\n- Amount: $${updated.budget_amount}\n- Period: ${updated.time_period}\n- Filter: ${updated.filter_prompt.substring(0, 100)}${updated.filter_prompt.length > 100 ? "..." : ""}\n\n⏳ **Processing in Progress**\n\nYour budget is being analyzed in the background. This typically takes **3-5 minutes** to match all your transactions.\n\nCheck back in a few minutes by saying "Show my budgets" to see the results!`,
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
    fixed_period_start_date: args.fixed_period_start_date || null,
    processing_status: "processing",
  });

  console.log(`[UPSERT-BUDGET] Created budget ${created.id}, starting async processing`);

  // Start background processing (non-blocking)
  startBudgetProcessing(userId, created);

  return {
    content: [
      {
        type: "text" as const,
        text: `✅ **Budget Created**\n\n**${created.title}**\n- Amount: $${created.budget_amount}\n- Period: ${created.time_period}\n- Filter: ${created.filter_prompt.substring(0, 100)}${created.filter_prompt.length > 100 ? "..." : ""}\n\n⏳ **Processing in Progress**\n\nYour budget is being analyzed in the background. This typically takes **3-5 minutes** to match all your transactions.\n\nCheck back in a few minutes by saying "Show my budgets" to see the results!`,
      },
    ],
    structuredContent: {
      budgets: [
        {
          id: created.id,
          title: created.title,
          amount: created.budget_amount,
          period: created.time_period,
          customPeriodDays: created.custom_period_days,
          spent: 0,
          remaining: created.budget_amount,
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
    budgetId: created.id,
  };
}
