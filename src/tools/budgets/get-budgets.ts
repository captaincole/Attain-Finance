import { z } from "zod";
import { getBudgets, getBudgetById, Budget } from "../../storage/budgets/budgets.js";
import { findAccountConnectionsByUserId } from "../../storage/repositories/account-connections.js";
import { findTransactionsByBudgetId } from "../../storage/repositories/transactions.js";
import { logToolEvent } from "../../utils/logger.js";
import { getSupabaseForUser } from "../../storage/supabase.js";

// Input schema for get-budgets tool
export const GetBudgetsArgsSchema = z.object({
  budget_id: z
    .string()
    .optional()
    .describe("Optional: Get specific budget by ID. If omitted, returns all budgets."),
  showTransactions: z
    .boolean()
    .default(false)
    .describe("Include matching transactions in the response (default: false)"),
});

export type GetBudgetsArgs = z.infer<typeof GetBudgetsArgsSchema>;

/**
 * Calculate date range for budget period
 */
function getBudgetDateRange(
  timePeriod: string,
  customPeriodDays?: number | null,
  fixedPeriodStartDate?: string | null
): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now); // Today

  // ROLLING BUDGETS: Last N days (continuously rolling window)
  if (timePeriod === "rolling") {
    if (!customPeriodDays) {
      throw new Error("custom_period_days required for rolling budgets");
    }
    const start = new Date(now);
    start.setDate(start.getDate() - customPeriodDays);
    start.setUTCHours(0, 0, 0, 0); // Use UTC to avoid timezone shifts
    return { start, end };
  }

  // FIXED BUDGETS: Calendar-based with anchor date
  if (!fixedPeriodStartDate) {
    throw new Error("fixed_period_start_date required for fixed budgets");
  }

  // Parse anchor date in UTC to avoid timezone shifts
  const [year, month, day] = fixedPeriodStartDate.split("-").map(Number);
  const anchorDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  switch (timePeriod) {
    case "weekly": {
      // Find the most recent period start (anchor date or multiples of 7 days later)
      const start = new Date(anchorDate);
      const daysSinceAnchor = Math.floor((now.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
      const periodsPassed = Math.floor(daysSinceAnchor / 7);
      start.setUTCDate(start.getUTCDate() + periodsPassed * 7);
      start.setUTCHours(0, 0, 0, 0);
      return { start, end };
    }

    case "biweekly": {
      // Find the most recent period start (anchor date or multiples of 14 days later)
      const start = new Date(anchorDate);
      const daysSinceAnchor = Math.floor((now.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
      const periodsPassed = Math.floor(daysSinceAnchor / 14);
      start.setUTCDate(start.getUTCDate() + periodsPassed * 14);
      start.setUTCHours(0, 0, 0, 0);
      return { start, end };
    }

    case "monthly": {
      // Find the most recent period start on the anchor day of the month
      const anchorDay = anchorDate.getUTCDate();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), anchorDay, 0, 0, 0, 0));

      // If anchor day is in the future this month, go back one month
      if (start > now) {
        start.setUTCMonth(start.getUTCMonth() - 1);
      }

      start.setUTCHours(0, 0, 0, 0);
      return { start, end };
    }

    case "quarterly": {
      // Find the most recent period start (anchor date or multiples of 3 months later)
      const start = new Date(anchorDate);
      const monthsSinceAnchor = (now.getUTCFullYear() - anchorDate.getUTCFullYear()) * 12 + (now.getUTCMonth() - anchorDate.getUTCMonth());
      const periodsPassed = Math.floor(monthsSinceAnchor / 3);
      start.setUTCMonth(start.getUTCMonth() + periodsPassed * 3);

      // If we're past the start, we're in the right period
      if (start > now) {
        start.setUTCMonth(start.getUTCMonth() - 3);
      }

      start.setUTCHours(0, 0, 0, 0);
      return { start, end };
    }

    case "yearly": {
      // Find the most recent period start on the anchor date's month/day
      const start = new Date(Date.UTC(now.getUTCFullYear(), anchorDate.getUTCMonth(), anchorDate.getUTCDate(), 0, 0, 0, 0));

      // If anchor date is in the future this year, go back one year
      if (start > now) {
        start.setUTCFullYear(start.getUTCFullYear() - 1);
      }

      start.setUTCHours(0, 0, 0, 0);
      return { start, end };
    }

    default:
      throw new Error(`Unknown time period: ${timePeriod}`);
  }
}

/**
 * Get Budgets Tool Handler
 * Fetches user budgets with current spending status from pre-labeled transactions
 */
export async function getBudgetsHandler(
  userId: string,
  args: GetBudgetsArgs
) {
  try {
    logToolEvent("get-budgets", "handler.start", { userId, args });

    const supabaseClient = getSupabaseForUser(userId);

    // Check if user has connected accounts
    const connections = await findAccountConnectionsByUserId(userId);
    logToolEvent("get-budgets", "handler.connections-loaded", {
      userId,
      connectionCount: connections.length,
    });

    if (connections.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `⚠️ **No Accounts Connected**\n\nPlease connect your account first by saying:\n"Connect my account"\n\n(For testing, this will use Plaid's sandbox with demo data)`,
          },
        ],
      };
    }

    // Fetch budget(s)
    const budgets = args.budget_id
      ? [await getBudgetById(userId, args.budget_id)].filter((b): b is Budget => b !== null)
      : await getBudgets(userId);

    if (budgets.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `📊 **No Budgets Found**\n\nCreate your first budget by saying:\n"Create a budget for [category] of $[amount] per [period]"\n\nExample: "Create a budget for coffee shops of $100 per week"`,
          },
        ],
        structuredContent: {
          budgets: [],
          widgetInstructions: getWidgetInstructions(),
          exampleBudgets: [
            "Weekly groceries $400",
            "Monthly subscriptions $50",
            "Daily coffee $15",
            "Custom coffee budget for next 7 days $100",
          ],
        },
        _meta: {
          "openai/outputTemplate": "ui://widget/budget-list.html",
          "openai/widgetAccessible": true,
        },
      };
    }

    // Process each budget: fetch PRE-LABELED transactions from database
    const budgetResults = [];

    for (const budget of budgets) {
      try {
        // Check if budget is still processing
        if (budget.processing_status === "processing") {
          budgetResults.push({
            id: budget.id,
            title: budget.title,
            amount: budget.budget_amount,
            period: budget.time_period,
            customPeriodDays: budget.custom_period_days,
            spent: 0,
            remaining: budget.budget_amount,
            percentage: 0,
            status: "under" as const,
            processingStatus: "processing",
            transactionCount: 0,
          });
          continue;
        }

        // Check if budget processing errored
        if (budget.processing_status === "error") {
          budgetResults.push({
            id: budget.id,
            title: budget.title,
            amount: budget.budget_amount,
            period: budget.time_period,
            customPeriodDays: budget.custom_period_days,
            spent: 0,
            remaining: budget.budget_amount,
            percentage: 0,
            status: "under" as const,
            processingStatus: "error",
            processingError: budget.processing_error || "Unknown error",
            transactionCount: 0,
          });
          continue;
        }

        // Budget is ready - process normally
        // Get date range for budget period
        const { start, end } = getBudgetDateRange(
          budget.time_period,
          budget.custom_period_days,
          budget.fixed_period_start_date
        );

        // Fetch PRE-LABELED transactions from database (NO AI call)
        const matchingTransactions = await findTransactionsByBudgetId(
          userId,
          budget.id,
          supabaseClient,
          start.toISOString().split("T")[0],
          end.toISOString().split("T")[0]
        );

        console.log(
          `[GET-BUDGETS] Budget "${budget.title}": ${matchingTransactions.length} matching transactions`
        );

        // Calculate total spent (sum of amounts)
        const totalSpent = matchingTransactions.reduce(
          (sum, tx) => sum + tx.amount,
          0
        );

        // Calculate budget status
        const remaining = budget.budget_amount - totalSpent;
        const percentage = (totalSpent / budget.budget_amount) * 100;
        const status =
          percentage >= 100 ? "over" : percentage >= 70 ? "near" : "under";

        budgetResults.push({
          id: budget.id,
          title: budget.title,
          amount: budget.budget_amount,
          period: budget.time_period,
          customPeriodDays: budget.custom_period_days,
          spent: totalSpent,
          remaining,
          percentage: Math.round(percentage),
          status,
          processingStatus: "ready",
          dateRange: {
            start: start.toISOString().split("T")[0],
            end: end.toISOString().split("T")[0],
          },
          transactionCount: matchingTransactions.length,
          ...(args.showTransactions && {
            transactions: matchingTransactions.map((tx) => ({
              date: tx.date,
              description: tx.name,
              amount: tx.amount,
              category: tx.customCategory || "Uncategorized",
              account_name: tx.accountName || "",
              pending: tx.pending,
            })),
          }),
        });
      } catch (error: any) {
        console.error(`[BUDGET] Error processing budget ${budget.id}:`, error);
        budgetResults.push({
          id: budget.id,
          title: budget.title,
          amount: budget.budget_amount,
          period: budget.time_period,
          error: error.message,
        });
      }
    }

    // Build response text
    let responseText = `📊 **Budget Status**\n\n`;

    for (const result of budgetResults) {
      if ("error" in result) {
        responseText += `❌ **${result.title}**: Error - ${result.error}\n\n`;
        continue;
      }

      // Check processing status
      if ("processingStatus" in result && result.processingStatus === "processing") {
        responseText += `⏳ **${result.title}**\n`;
        responseText += `- Status: Processing transactions...\n`;
        responseText += `- Amount: $${result.amount.toFixed(2)}\n`;
        responseText += `- Period: ${result.period}${result.customPeriodDays ? ` (${result.customPeriodDays} days)` : ""}\n`;
        responseText += `\nYour budget is being analyzed. Check back in a moment!\n\n`;
        continue;
      }

      if ("processingStatus" in result && result.processingStatus === "error") {
        responseText += `❌ **${result.title}**\n`;
        responseText += `- Status: Processing failed\n`;
        responseText += `- Error: ${result.processingError}\n`;
        responseText += `- Amount: $${result.amount.toFixed(2)}\n\n`;
        continue;
      }

      const statusEmoji = result.status === "over" ? "🔴" : result.status === "near" ? "🟡" : "🟢";
      responseText += `${statusEmoji} **${result.title}**\n`;
      responseText += `- Spent: $${result.spent.toFixed(2)} / $${result.amount.toFixed(2)} (${result.percentage}%)\n`;
      responseText += `- Remaining: $${result.remaining.toFixed(2)}\n`;
      responseText += `- Period: ${result.period}${result.customPeriodDays ? ` (${result.customPeriodDays} days)` : ""}\n`;
      responseText += `- Transactions: ${result.transactionCount}\n`;
      if ("dateRange" in result) {
        responseText += `- Date Range: ${result.dateRange.start} to ${result.dateRange.end}\n`;
      }
      responseText += `\n`;
    }

    responseText += `\n**Commands:**\n`;
    responseText += `- "Show transactions for [budget name]" - View detailed transactions\n`;
    responseText += `- "Update my [budget name] to $[amount]" - Modify budget\n`;
    responseText += `- "Create a new budget" - Add another budget\n`;
    responseText += `\n💡 **Tip:** Run "Refresh transactions" to update with latest bank data.`;

    return {
      content: [
        {
          type: "text" as const,
          text: responseText.trim(),
        },
      ],
      structuredContent: {
        budgets: budgetResults,
        widgetInstructions: getWidgetInstructions(),
        exampleBudgets: [
          "Weekly groceries $400",
          "Monthly subscriptions $50",
          "Daily coffee $15",
        ],
      },
      _meta: {
        "openai/outputTemplate": "ui://widget/budget-list.html",
        "openai/widgetAccessible": true,
        "openai/resultCanProduceWidget": true,
      },
    };
  } catch (error: any) {
    console.error("[GET-BUDGETS-HANDLER] Caught error:", error);
    console.error("[GET-BUDGETS-HANDLER] Error stack:", error.stack);

    return {
      content: [
        {
          type: "text" as const,
          text: `❌ **Error**\n\n${error.message}\n\n\`\`\`\n${error.stack}\n\`\`\``,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Widget and ChatGPT guidance instructions
 */
function getWidgetInstructions(): string {
  return `
BUDGET CREATION GUIDE:

When creating budgets, generate specific filter prompts that describe which transactions to include.

GOOD EXAMPLES:
✓ "Include coffee shops like Starbucks, Dunkin, local cafes, and any merchant with 'coffee' or 'espresso' in the name"
✓ "Include grocery stores: Whole Foods, Safeway, Trader Joe's, and transactions categorized as 'Groceries'"
✓ "Include streaming services: Netflix, Spotify, Hulu, Disney+, and any subscription in Entertainment category"
✓ "Include restaurants and food delivery services like DoorDash, Uber Eats, and any merchant in Food & Dining category"

BAD EXAMPLES (too vague):
❌ "Coffee purchases"
❌ "Food spending"
❌ "Entertainment"

TIME PERIOD OPTIONS:

ROLLING BUDGETS (continuously rolling window):
- time_period: "rolling"
- custom_period_days: N (e.g., 7 for last 7 days, 30 for last 30 days, 90 for last 3 months)
- Example: "Budget for last 7 days" always shows spending from today minus 7 days

FIXED BUDGETS (calendar-based with custom start date):
- time_period: "weekly" - Resets every 7 days from anchor date
  - fixed_period_start_date: Any date (e.g., "2025-10-14" for Monday, "2025-10-12" for Saturday)
- time_period: "biweekly" - Resets every 14 days from anchor date
  - fixed_period_start_date: Payday date (e.g., "2025-10-11" for every other Friday)
- time_period: "monthly" - Resets every month on anchor day
  - fixed_period_start_date: Start day (e.g., "2025-01-15" for 15th of each month, "2025-01-01" for 1st)
- time_period: "quarterly" - Resets every 3 months from anchor date
- time_period: "yearly" - Resets every year on anchor date

LEADING QUESTIONS TO ASK USERS:
1. "What type of spending would you like to budget?"
2. "How much do you want to spend?"
3. "Should this be a rolling budget (last N days) or a fixed budget that resets on a schedule?"
4. For rolling: "How many days should I track? (e.g., 7, 30, 90)"
5. For fixed: "What period works best? (weekly/biweekly/monthly/quarterly/yearly)"
6. For fixed: "What day should the budget start? (e.g., 1st of month, every Monday, payday)"

EXAMPLE BUDGET FLOWS:

User: "I want to budget for coffee"
You: "I'll help you create a coffee budget. How much would you like to spend, and should this track the last 7 days or reset weekly?"
User: "Last 7 days, $100"
You: [Call upsert-budget with:
  time_period: "rolling",
  custom_period_days: 7,
  budget_amount: 100,
  filter_prompt: "Include coffee shops like Starbucks, Dunkin, Peet's Coffee, and any merchant with 'coffee', 'espresso', or 'cafe' in the name"]

User: "Create a grocery budget for $400 per month starting on the 15th"
You: [Call upsert-budget with:
  time_period: "monthly",
  fixed_period_start_date: "2025-01-15",
  budget_amount: 400,
  filter_prompt: "Include grocery stores like Whole Foods, Safeway, Trader Joe's, Kroger, and any transaction categorized as 'Groceries' or 'Supermarkets'"]

User: "Budget $1000 every two weeks starting this Friday"
You: [Calculate next Friday's date, then call upsert-budget with:
  time_period: "biweekly",
  fixed_period_start_date: "2025-10-18",
  budget_amount: 1000,
  filter_prompt: (based on user's spending category)]
  `.trim();
}
