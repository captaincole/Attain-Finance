import { z } from "zod";
import { generateSignedUrl } from "../../utils/signed-urls.js";
import { getBaseUrl } from "../../utils/config.js";
import { getDemoTransactions } from "../../storage/demo/transactions.js";
import { getDemoBankSnapshot } from "../../storage/demo/banking.js";
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
      "View recent credit card transactions for the demo user. Provides raw transaction data and a downloadable CSV seeded from example Chase activity.",
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
            csvDownloadUrl: null,
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
        source: "credit-card" as const,
      }));

      let bankSnapshot = null;
      try {
        bankSnapshot = await getDemoBankSnapshot(userId);
      } catch (error) {
        logToolEvent(
          "get-transactions",
          "bank-snapshot-error",
          { userId, error: (error as Error).message },
          "warn"
        );
      }

      const bankStructuredTransactions =
        bankSnapshot?.transactions.map((tx) => ({
          transaction_id: tx.id,
          date: tx.date,
          description: tx.description,
          merchant: tx.description,
          amount: Math.abs(Number(tx.amount) || 0),
          direction: tx.direction,
          category: tx.category || "Uncategorized",
          source: "bank-account" as const,
        })) ?? [];

      const combinedTransactions = [...structuredTransactions, ...bankStructuredTransactions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      const csvContent = convertTransactionsToCsv(structuredTransactions);
      const baseUrl = getBaseUrl();
      const downloadUrl = generateSignedUrl(baseUrl, userId, "transactions", 600);
      demoTransactionCsvCache.set(userId, csvContent);

      let responseText = `💳 **Credit Card Transactions**\n\n`;
      responseText += `Date range: ${startDate} → ${endDate}\n`;
      if (snapshot.account) {
        responseText += `Account: ${snapshot.account.name} (${snapshot.account.institution_name})\n\n`;
      }
      responseText += `Returned ${structuredTransactions.length} credit card transactions.\n`;
      if (bankStructuredTransactions.length > 0 && bankSnapshot?.account) {
        responseText += `Included ${bankStructuredTransactions.length} bank account transactions from ${bankSnapshot.account.name}.\n`;
      }
      responseText += "\n";
      responseText += `**Download CSV**\n\`curl "${downloadUrl}" -o transactions.csv\``;

      logToolEvent("get-transactions", "demo-summary", {
        userId,
        transactions: structuredTransactions.length,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: responseText,
          },
        ],
        structuredContent: {
          accounts: {
            creditCard: snapshot.account
              ? {
                  account_id: snapshot.account.account_id,
                  name: snapshot.account.name,
                  institution_name: snapshot.account.institution_name,
                  type: snapshot.account.type,
                  subtype: snapshot.account.subtype,
                  current_balance: snapshot.account.current_balance,
                  available_credit: snapshot.account.available_credit,
                }
              : null,
            bank: bankSnapshot?.account
              ? {
                  account_id: bankSnapshot.account.account_id,
                  name: bankSnapshot.account.name,
                  institution_name: bankSnapshot.account.institution_name,
                  type: bankSnapshot.account.type,
                  subtype: bankSnapshot.account.subtype,
                  current_balance: bankSnapshot.account.balances_current,
                }
              : null,
          },
          transactions: structuredTransactions,
          bankTransactions: bankStructuredTransactions,
          combinedTransactions,
          csvDownloadUrl: downloadUrl,
          instructions:
            "Treat transfers into investments or savings as allocations, not spending. Focus on debit transactions for true outflows when analyzing budgets.",
        },
      };
    },
  };
}
