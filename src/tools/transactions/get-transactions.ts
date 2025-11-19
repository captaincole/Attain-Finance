import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../storage/database.types.js";
import { generateSignedUrl } from "../../utils/signed-urls.js";
import { findAccountConnectionsByUserId } from "../../storage/repositories/account-connections.js";
import { findTransactionsByUserId } from "../../storage/repositories/transactions.js";
import { logToolEvent } from "../../utils/logger.js";

// Input schema for get-transactions tool
export const GetTransactionsArgsSchema = {
  start_date: z
    .string()
    .optional()
    .describe("Start date in YYYY-MM-DD format (default: all available data)"),
  end_date: z
    .string()
    .optional()
    .describe("End date in YYYY-MM-DD format (default: today)"),
  account_ids: z
    .array(z.string())
    .optional()
    .describe("Filter transactions by account IDs (exact match). Get account IDs by calling get-account-status tool first. Example: ['account_123', 'account_456']"),
  categories: z
    .array(z.string())
    .optional()
    .describe("Filter transactions by category names (case-insensitive partial match). Searches AI-generated custom categories. Multiple categories use OR logic. Example: ['Food', 'Transport'] will match 'Food & Dining', 'Transportation', etc."),
  budget_id: z
    .string()
    .optional()
    .describe("Filter transactions tagged to a specific budget (exact match). Get budget IDs by calling get-budgets tool first. Example: 'budget_123'"),
  pending_only: z
    .boolean()
    .optional()
    .describe("Show only pending transactions (exact match). Useful for cash flow management and seeing what charges haven't cleared yet. Cannot be used with exclude_pending."),
  exclude_pending: z
    .boolean()
    .optional()
    .describe("Exclude pending transactions (exact match). Shows only confirmed/cleared transactions. Useful for accurate spending analysis. Cannot be used with pending_only."),
};

export type GetTransactionsArgs = {
  start_date?: string;
  end_date?: string;
  account_ids?: string[];
  categories?: string[];
  budget_id?: string;
  pending_only?: boolean;
  exclude_pending?: boolean;
};

// Output schema for get-transactions tool (using Zod for type safety and validation)
// This defines the structure of the tool's response, including both human-readable content
// and machine-readable structuredContent fields
export const GetTransactionsOutputSchema = {
  structuredContent: z.object({
    transactions: z.array(
      z.object({
        date: z.string().describe("Transaction date in YYYY-MM-DD format"),
        description: z.string().describe("Merchant or transaction description"),
        amount: z.number().describe("Transaction amount in dollars (positive = spending, negative = income in some systems)"),
        category: z.string().describe("AI-assigned category using user's custom categorization rules"),
        account_name: z.string().describe("Name of the account this transaction came from"),
        pending: z.boolean().describe("Whether this transaction is still pending"),
      })
    ).describe("Array of transactions with AI-powered categorization"),
    summary: z.object({
      transactionCount: z.number().describe("Total number of transactions returned"),
      dateRange: z.object({
        start: z.string().describe("Start date of transaction range in YYYY-MM-DD format"),
        end: z.string().describe("End date of transaction range in YYYY-MM-DD format"),
      }).describe("Date range for the transactions"),
    }).describe("Summary statistics for the transaction set"),
    dataInstructions: z.string().describe("Guidelines for analyzing transaction data (spending categories, large expenses, data structure)"),
    visualizationInstructions: z.string().describe("Recommendations for visualizing transaction data (spending by category, trends over time, top merchants, account breakdown)"),
  }).optional().describe("Structured transaction data for programmatic use"),
};

// Storage for temporary transaction data (in-memory for MVP)
const userTransactionData = new Map<string, string>();

/**
 * Convert transactions to CSV format
 */
function convertTransactionsToCSV(transactions: any[]): string {
  const headers = [
    "date",
    "description",
    "amount",
    "category",
    "account_name",
    "pending",
  ];

  const rows = transactions.map((tx) => {
    return [
      tx.date,
      `"${tx.description.replace(/"/g, '""')}"`, // Escape quotes in description
      tx.amount,
      `"${tx.category}"`,
      `"${tx.account_name}"`,
      tx.pending ? "true" : "false",
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Get Transactions Tool
 * Fetches transaction data from the database (must call refresh-transactions first)
 */
export async function getPlaidTransactionsHandler(
  userId: string,
  baseUrl: string,
  args: GetTransactionsArgs,
  supabaseClient: SupabaseClient<Database>
) {
  // Check if user has connections
  const connections = await findAccountConnectionsByUserId(userId);

  if (connections.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `
⚠️ **No Accounts Connected**

Please connect your account first by saying:
"Connect my account"

(For testing, this will use Plaid's sandbox with demo data)
          `.trim(),
        },
      ],
    };
  }

  // Parse dates or use defaults (all transactions: 2 years back)
  const endDate = args.end_date || new Date().toISOString().split("T")[0];
  const startDate = args.start_date || (() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 2);
    return date.toISOString().split("T")[0];
  })();

  // Fetch transactions from DATABASE (not Plaid)
  const transactions = await findTransactionsByUserId(userId, supabaseClient, startDate, endDate, {
    startDate,
    endDate,
    accountIds: args.account_ids,
    categories: args.categories,
    budgetId: args.budget_id,
    pendingOnly: args.pending_only,
    excludePending: args.exclude_pending,
  });

  logToolEvent("get-transactions", "transactions-loaded", {
    userId,
    count: transactions.length,
    startDate,
    endDate,
    accountFilter: args.account_ids ? `${args.account_ids.length} accounts` : "all accounts",
    categoryFilter: args.categories ? `${args.categories.length} categories` : "all categories",
    budgetFilter: args.budget_id || "no budget filter",
    pendingFilter: args.pending_only ? "pending only" : args.exclude_pending ? "exclude pending" : "all",
  });

  if (transactions.length === 0) {
    let responseText = `📊 **No Transactions Found**\n\n`;
    responseText += `No transactions found in database for the period:\n`;
    responseText += `- Start: ${startDate}\n`;
    responseText += `- End: ${endDate}\n\n`;
    responseText += `💡 **Tip:** Run "Refresh transactions" to sync latest data from your bank.`;

    return {
      content: [
        {
          type: "text" as const,
          text: responseText.trim(),
        },
      ],
    };
  }

  // Convert to structured format
  const structuredTransactions = transactions.map((tx) => ({
    date: tx.date,
    description: tx.name,
    amount: tx.amount,
    category: tx.customCategory || "Uncategorized",
    account_name: tx.accountName || "",
    pending: tx.pending,
  }));

  // Generate CSV for download
  const csvContent = convertTransactionsToCSV(structuredTransactions);
  const downloadUrl = generateSignedUrl(baseUrl, userId, "transactions", 600);
  userTransactionData.set(userId, csvContent);

  // Check if data might be stale
  const hasUncategorized = transactions.some((tx) => !tx.customCategory);
  const stalenessWarning = hasUncategorized
    ? `\n\n⚠️ **Note:** Some transactions are uncategorized. Run "Refresh transactions" to categorize them.`
    : "";

  let responseText = `📊 **Transactions Retrieved**\n\n`;
  responseText += `Found ${transactions.length} transactions from database\n\n`;
  responseText += `**Date Range:**\n- Start: ${startDate}\n- End: ${endDate}\n\n`;
  responseText += `**Raw Data Download:**\n\`\`\`bash\ncurl "${downloadUrl}" -o transactions.csv\n\`\`\`\n\n`;
  responseText += `**Note:** Download link expires in 10 minutes.`;
  responseText += stalenessWarning;
  responseText += `\n\n💡 **Tip:** Run "Refresh transactions" to get the latest data from your bank.`;

  // Data instructions for AI analysis
  const dataInstructions = `
TRANSACTION DATA ANALYSIS GUIDELINES:

1. SPENDING CATEGORIES (exclude these when analyzing spending):
   - Income: Money received (salary, refunds, etc.)
   - Transfer: Money moved between accounts
   - Payment: Bill payments and transfers out

2. SPENDING ANALYSIS:
   - Use category field for categorization (AI-assigned using user's custom rules)
   - Spending transactions typically have positive amounts
   - Income transactions are in the "Income" category
   - Group by category and sum amounts to get spending by category

3. LARGE EXPENSES:
   - To find what a large expense is, look at the top 5 purchase in a given month and assume that if their is a price drop off, the purchases larger than that are considered large expenses.
   - Consider separating recurring vs. one-time expenses

4. DATA STRUCTURE:
   - date: Transaction date (YYYY-MM-DD)
   - description: Merchant or transaction description
   - amount: Transaction amount (positive = spending, negative = income in some systems)
   - category: AI-assigned category using user's custom categorization rules
   - account_name: Which account the transaction came from
   - pending: Whether transaction is still pending
  `.trim();

  const visualizationInstructions = `
VISUALIZATION RECOMMENDATIONS:

1. SPENDING BY CATEGORY (Bar Chart):
   - Filter out Income, Transfer, and Payment categories
   - Group remaining transactions by category
   - Sum the amounts for each category
   - Sort categories by total amount (highest first)
   - Display as horizontal bar chart with dollar amounts

2. SPENDING OVER TIME (Line Chart):
   - Group transactions by date
   - Calculate daily/weekly/monthly spending totals
   - Exclude Income/Transfer/Payment categories
   - Show trend line

3. TOP MERCHANTS:
   - Group by description field
   - Sum amounts per merchant
   - Show top 10 merchants by spending

4. ACCOUNT BREAKDOWN:
   - Group by account_name
   - Show spending distribution across accounts
  `.trim();

  return {
    content: [
      {
        type: "text" as const,
        text: responseText.trim(),
      },
    ],
    structuredContent: {
      transactions: structuredTransactions,
      summary: {
        transactionCount: transactions.length,
        dateRange: {
          start: startDate,
          end: endDate,
        },
      },
      dataInstructions,
      visualizationInstructions,
    },
  };
}

/**
 * Export storage map for use in download endpoint
 */
export { userTransactionData };
