import { z } from "zod";
import { generateSignedUrl } from "../../utils/signed-urls.js";
import { getBaseUrl } from "../../utils/config.js";
import { getDemoTransactions } from "../../storage/demo/transactions.js";
import { logToolEvent } from "../../utils/logger.js";
import type { ToolDefinition } from "../types.js";

interface GetDemoTransactionsArgs {
  start_date?: string;
  end_date?: string;
  limit?: number;
  top_categories?: number;
}

const demoTransactionCsvCache = new Map<string, string>();

function convertTransactionsToCsv(transactions: any[]): string {
  const headers = [
    "date",
    "description",
    "amount",
    "direction",
    "category",
  ];

  const rows = transactions.map((tx) =>
    [
      tx.date,
      `"${tx.description.replace(/"/g, '""')}"`,
      tx.amount,
      tx.direction,
      `"${tx.category.replace(/"/g, '""')}"`,
    ].join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

export { demoTransactionCsvCache };

export function getDemoTransactionsTool(): ToolDefinition {
  return {
    name: "get-transactions",
    description:
      "View recent credit card transactions for the demo user. Returns spending summaries, top categories, and downloadable CSV data seeded from example Chase activity.",
    inputSchema: {
      start_date: z
        .string()
        .optional()
        .describe("Start date in YYYY-MM-DD format (default: 60 days ago)"),
      end_date: z
        .string()
        .optional()
        .describe("End date in YYYY-MM-DD format (default: today)"),
      limit: z
        .number()
        .int()
        .positive()
        .max(200)
        .optional()
        .describe("Maximum number of transactions to return (default: 120)"),
      top_categories: z
        .number()
        .int()
        .positive()
        .max(10)
        .optional()
        .describe("How many top categories to highlight in the response (default: 5)"),
    },
    options: {
      readOnlyHint: true,
      securitySchemes: [{ type: "oauth2" }],
      _meta: {
        "openai/outputTemplate": "ui://widget/spending-summary.html",
        "openai/toolInvocation/invoking": "Analyzing recent spending...",
        "openai/toolInvocation/invoked": "Spending summary ready",
        "openai/widgetAccessible": true,
        "openai/resultCanProduceWidget": true,
      },
    },
    handler: async (args: GetDemoTransactionsArgs, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;
      if (!userId) {
        throw new Error("User authentication required");
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const endDate = args.end_date || today.toISOString().split("T")[0];
      const startDate =
        args.start_date || (() => {
          const start = new Date(today);
          start.setMonth(start.getMonth() - 2);
          return start.toISOString().split("T")[0];
        })();

      const snapshot = await getDemoTransactions(userId, {
        startDate,
        endDate,
        limit: args.limit ?? 120,
      });

      if (snapshot.transactions.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `📭 **No demo transactions found**\n\nSeed the demo transactions with:\n\n	npm run demo:seed-transactions`,
            },
          ],
          structuredContent: {
            transactions: [],
            summary: {},
          },
        };
      }

      const structuredTransactions = snapshot.transactions.map((tx) => ({
        transaction_id: tx.transaction_id,
        date: tx.date,
        description: tx.description,
        merchant: tx.merchant_name,
        amount: tx.amount,
        direction: tx.direction,
        category: tx.category || "Uncategorized",
      }));

      const csvContent = convertTransactionsToCsv(structuredTransactions);
      const baseUrl = getBaseUrl();
      const downloadUrl = generateSignedUrl(baseUrl, userId, "transactions", 600);
      demoTransactionCsvCache.set(userId, csvContent);

      const topCategories = snapshot.categoryTotals
        .slice(0, args.top_categories ?? 5)
        .map(
          (category, index) =>
            `${index + 1}. ${category.category}: $${category.amount.toFixed(2)}`
        )
        .join("\n");

      const spendingVsPayments = `• Spending: $${snapshot.spendingTotal.toFixed(2)}\n• Payments: $${snapshot.paymentsTotal.toFixed(2)}\n• Credits/Refunds: $${snapshot.incomeTotal.toFixed(2)}`;

      let responseText = `💳 **Demo Credit Card Transactions**\n\n`;
      responseText += `Date range: ${startDate} → ${endDate}\n`;
      if (snapshot.account) {
        responseText += `Account: ${snapshot.account.name} (${snapshot.account.institution_name})\n\n`;
      }
      responseText += `**Spending vs Payments**\n${spendingVsPayments}\n\n`;
      responseText += `**Top Categories**\n${topCategories || "-"}\n\n`;
      responseText += `**Download CSV**\n\`curl "${downloadUrl}" -o demo-transactions.csv\``;

      logToolEvent("get-transactions", "demo-summary", {
        userId,
        transactions: structuredTransactions.length,
        spendingTotal: snapshot.spendingTotal,
        paymentsTotal: snapshot.paymentsTotal,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: responseText,
          },
        ],
        structuredContent: {
          transactions: structuredTransactions,
          categoryTotals: snapshot.categoryTotals,
          summary: {
            spendingTotal: snapshot.spendingTotal,
            paymentsTotal: snapshot.paymentsTotal,
            incomeTotal: snapshot.incomeTotal,
            topCategories: snapshot.categoryTotals.slice(0, 5),
            csvDownloadUrl: downloadUrl,
          },
        },
      };
    },
  };
}
