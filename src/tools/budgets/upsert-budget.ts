import { z } from "zod";
import crypto from "crypto";
import {
  getBudgetById,
  createBudget,
  updateBudget,
} from "../../storage/budgets/budgets.js";
import { labelTransactionsForSingleBudget } from "../../utils/budget-labeling.js";

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
 * Creates a new budget or updates an existing one, then triggers transaction labeling
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

      console.log(`[UPSERT-BUDGET] Updated budget ${updated.id}, triggering transaction labeling`);

      // Trigger budget labeling for this budget
      let matchingCount = 0;
      try {
        matchingCount = await labelTransactionsForSingleBudget(userId, updated);
        console.log(`[UPSERT-BUDGET] Labeled ${matchingCount} transactions for updated budget`);
      } catch (error: any) {
        console.error(`[UPSERT-BUDGET] Error labeling transactions:`, error.message);
      }

      const now = new Date();

      return {
        content: [
          {
            type: "text" as const,
            text: `✅ **Budget Updated**\n\n**${updated.title}**\n- Amount: $${updated.budget_amount}\n- Period: ${updated.time_period}\n- Filter: ${updated.filter_prompt.substring(0, 100)}${updated.filter_prompt.length > 100 ? "..." : ""}\n- Matching Transactions: ${matchingCount}\n\nYour budget has been updated and transactions have been labeled!`,
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
              spent: 0, // Will be calculated on next get-budgets call
              remaining: updated.budget_amount,
              percentage: 0,
              status: "under" as const,
              dateRange: {
                start: now.toISOString().split("T")[0],
                end: now.toISOString().split("T")[0],
              },
              transactionCount: matchingCount,
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
  });

  console.log(`[UPSERT-BUDGET] Created budget ${created.id}, triggering transaction labeling`);

  // Trigger budget labeling for this new budget
  let matchingCount = 0;
  try {
    matchingCount = await labelTransactionsForSingleBudget(userId, created);
    console.log(`[UPSERT-BUDGET] Labeled ${matchingCount} transactions for new budget`);
  } catch (error: any) {
    console.error(`[UPSERT-BUDGET] Error labeling transactions:`, error.message);
  }

  const now = new Date();

  return {
    content: [
      {
        type: "text" as const,
        text: `✅ **Budget Created**\n\n**${created.title}**\n- Amount: $${created.budget_amount}\n- Period: ${created.time_period}\n- Filter: ${created.filter_prompt.substring(0, 100)}${created.filter_prompt.length > 100 ? "..." : ""}\n- Matching Transactions: ${matchingCount}\n\nYour new budget is ready to track spending!`,
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
          spent: 0, // Will be calculated on next get-budgets call
          remaining: created.budget_amount,
          percentage: 0,
          status: "under" as const,
          dateRange: {
            start: now.toISOString().split("T")[0],
            end: now.toISOString().split("T")[0],
          },
          transactionCount: matchingCount,
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
