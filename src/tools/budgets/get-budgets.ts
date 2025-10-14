import { z } from "zod";
import { PlaidApi } from "plaid";
import { getBudgets, getBudgetById, Budget } from "../../storage/budgets/budgets.js";
import { getConnections } from "../../storage/plaid/connections.js";
import {
  filterTransactionsForBudget,
  TransactionForBudgetFilter,
} from "../../utils/clients/claude.js";

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
  customPeriodDays?: number | null
): { start: Date; end: Date } {
  const end = new Date(); // Today
  const start = new Date();

  switch (timePeriod) {
    case "daily":
      // Start of today
      start.setHours(0, 0, 0, 0);
      break;

    case "weekly":
      // Start of this week (Monday)
      const dayOfWeek = start.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 0
      start.setDate(start.getDate() - daysToMonday);
      start.setHours(0, 0, 0, 0);
      break;

    case "monthly":
      // Start of this month
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;

    case "custom":
      // Custom number of days
      if (!customPeriodDays) {
        throw new Error("custom_period_days required for custom time period");
      }
      start.setDate(start.getDate() - customPeriodDays);
      start.setHours(0, 0, 0, 0);
      break;

    default:
      throw new Error(`Unknown time period: ${timePeriod}`);
  }

  return { start, end };
}

/**
 * Get Budgets Tool Handler
 * Fetches user budgets with current spending status
 */
export async function getBudgetsHandler(
  userId: string,
  args: GetBudgetsArgs,
  plaidClient: PlaidApi
) {
  // Check if user has connected accounts
  const connections = await getConnections(userId);

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
    };
  }

  // Process each budget: fetch transactions and calculate spending
  const budgetResults = [];

  for (const budget of budgets) {
    try {
      // Get date range for budget period
      const { start, end } = getBudgetDateRange(
        budget.time_period,
        budget.custom_period_days
      );

      // Fetch transactions for this period from all connections
      const allTransactions: any[] = [];
      const accountMap = new Map<string, string>();

      for (const connection of connections) {
        try {
          // Get account details
          const accountsResponse = await plaidClient.accountsGet({
            access_token: connection.accessToken,
          });

          const institutionName =
            accountsResponse.data.item.institution_name || "Unknown";

          // Build account name map
          for (const account of accountsResponse.data.accounts) {
            const accountType = account.subtype || account.type || "Account";
            const mask = account.mask ? `****${account.mask}` : "";
            const accountLabel = mask
              ? `${institutionName} - ${accountType} (${mask})`
              : `${institutionName} - ${accountType}`;

            accountMap.set(account.account_id, accountLabel);
          }

          // Get transactions
          const response = await plaidClient.transactionsGet({
            access_token: connection.accessToken,
            start_date: start.toISOString().split("T")[0],
            end_date: end.toISOString().split("T")[0],
            options: {
              count: 500,
              offset: 0,
            },
          });

          allTransactions.push(...response.data.transactions);
        } catch (error: any) {
          console.error(
            `[BUDGET] Error fetching transactions for ${connection.itemId}:`,
            error.message
          );
        }
      }

      // Prepare transactions for budget filtering (with unique IDs)
      const transactionsForFilter: TransactionForBudgetFilter[] =
        allTransactions.map((tx, index) => ({
          id: `tx-${index}`, // Simple unique ID
          date: tx.date,
          description: tx.name,
          amount: tx.amount,
          category: tx.category ? tx.category.join(", ") : "Uncategorized",
          account_name: accountMap.get(tx.account_id) || tx.account_id,
          pending: tx.pending,
        }));

      // Call Claude API to filter transactions based on budget criteria
      let matchingTransactions: TransactionForBudgetFilter[] = [];
      let totalSpent = 0;

      if (transactionsForFilter.length > 0) {
        const filterResults = await filterTransactionsForBudget(
          transactionsForFilter,
          budget.filter_prompt
        );

        // Extract matching transactions
        const matchingIds = new Set(
          filterResults.filter((r) => r.matches).map((r) => r.transaction_id)
        );

        matchingTransactions = transactionsForFilter.filter((tx) =>
          matchingIds.has(tx.id)
        );

        // Calculate total spent (sum of amounts)
        totalSpent = matchingTransactions.reduce(
          (sum, tx) => sum + tx.amount,
          0
        );
      }

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
        dateRange: {
          start: start.toISOString().split("T")[0],
          end: end.toISOString().split("T")[0],
        },
        transactionCount: matchingTransactions.length,
        ...(args.showTransactions && {
          transactions: matchingTransactions.map((tx) => ({
            date: tx.date,
            description: tx.description,
            amount: tx.amount,
            category: tx.category,
            account_name: tx.account_name,
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

    const statusEmoji = result.status === "over" ? "🔴" : result.status === "near" ? "🟡" : "🟢";
    responseText += `${statusEmoji} **${result.title}**\n`;
    responseText += `- Spent: $${result.spent.toFixed(2)} / $${result.amount.toFixed(2)} (${result.percentage}%)\n`;
    responseText += `- Remaining: $${result.remaining.toFixed(2)}\n`;
    responseText += `- Period: ${result.period}${result.customPeriodDays ? ` (${result.customPeriodDays} days)` : ""}\n`;
    responseText += `- Transactions: ${result.transactionCount}\n`;
    responseText += `- Date Range: ${result.dateRange.start} to ${result.dateRange.end}\n\n`;
  }

  responseText += `\n**Commands:**\n`;
  responseText += `- "Show transactions for [budget name]" - View detailed transactions\n`;
  responseText += `- "Update my [budget name] to $[amount]" - Modify budget\n`;
  responseText += `- "Create a new budget" - Add another budget\n`;

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

TIME PERIODS:
- daily: Budget resets each day (midnight to midnight)
- weekly: Budget resets each Monday
- monthly: Budget resets on 1st of each month
- custom: Specify number of days (e.g., 7 days, 30 days)

LEADING QUESTIONS TO ASK USERS:
1. "What type of spending would you like to budget?"
2. "How much do you want to spend per [period]?"
3. "Should I include specific merchants or categories?"
4. "Would you like to set this as a daily, weekly, or monthly budget?"

EXAMPLE BUDGET FLOWS:
User: "I want to budget for coffee"
You: "I'll help you create a coffee budget. How much would you like to spend on coffee per week?"
User: "$100 per week"
You: [Call upsert-budget with filter_prompt: "Include coffee shops like Starbucks, Dunkin, Peet's Coffee, and any merchant with 'coffee', 'espresso', or 'cafe' in the name"]

User: "Create a grocery budget"
You: "How much would you like to spend on groceries per month?"
User: "$400"
You: [Call upsert-budget with filter_prompt: "Include grocery stores like Whole Foods, Safeway, Trader Joe's, Kroger, and any transaction categorized as 'Groceries' or 'Supermarkets'"]
  `.trim();
}
