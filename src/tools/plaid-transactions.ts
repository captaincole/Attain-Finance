import { PlaidApi } from "plaid";
import { generateSignedUrl } from "../utils/signed-urls.js";
import { getConnection } from "../db/plaid-storage.js";

interface GetTransactionsArgs {
  start_date?: string;
  end_date?: string;
}

// Storage for temporary transaction data (in-memory for MVP)
const userTransactionData = new Map<string, string>();

/**
 * Convert Plaid transactions to CSV format
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
      `"${tx.name.replace(/"/g, '""')}"`, // Escape quotes in description
      tx.amount,
      tx.category ? `"${tx.category.join(", ")}"` : '""',
      tx.account_id,
      tx.pending ? "true" : "false",
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Get Plaid Transactions Tool
 * Fetches real transaction data from connected Plaid account
 */
export async function getPlaidTransactionsHandler(
  userId: string,
  baseUrl: string,
  args: GetTransactionsArgs,
  plaidClient: PlaidApi
) {
  // Load connection from database
  const connection = await getConnection(userId);

  if (!connection) {
    return {
      content: [
        {
          type: "text" as const,
          text: `
⚠️ **No Bank Account Connected**

Please connect your bank first by saying:
"Connect my bank account"

(For testing, this will use Plaid's sandbox with fake data)
          `.trim(),
        },
      ],
    };
  }

  // Parse dates or use defaults (last 90 days)
  const endDate = args.end_date
    ? new Date(args.end_date)
    : new Date();
  const startDate = args.start_date
    ? new Date(args.start_date)
    : (() => {
        const date = new Date();
        date.setDate(date.getDate() - 90);
        return date;
      })();

  try {
    // Fetch transactions from Plaid
    const response = await plaidClient.transactionsGet({
      access_token: connection.accessToken,
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
      options: {
        count: 500, // Get up to 500 transactions
        offset: 0,
      },
    });

    const transactions = response.data.transactions;

    if (transactions.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `
📊 **No Transactions Found**

No transactions found for the period:
- Start: ${startDate.toISOString().split("T")[0]}
- End: ${endDate.toISOString().split("T")[0]}

Try adjusting the date range or ensuring your bank account has transaction history.
            `.trim(),
          },
        ],
      };
    }

    // Convert to CSV format
    const csvContent = convertTransactionsToCSV(transactions);

    // Generate signed download URL for transactions
    const transactionsUrl = generateSignedUrl(
      baseUrl,
      userId,
      "transactions",
      600 // 10 minute expiry
    );

    // Store CSV for download endpoint
    userTransactionData.set(userId, csvContent);

    return {
      content: [
        {
          type: "text" as const,
          text: `
📊 **Transactions Retrieved**

Found ${transactions.length} transactions from ${connection.itemId}

**Date Range:**
- Start: ${startDate.toISOString().split("T")[0]}
- End: ${endDate.toISOString().split("T")[0]}

**Download Instructions:**

\`\`\`bash
curl "${transactionsUrl}" -o transactions.csv
\`\`\`

**Note:** Download link expires in 10 minutes.

**What you can do next:**
- Analyze the CSV file
- Track subscriptions with: "Track my subscriptions"
- Categorize spending patterns
          `.trim(),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text" as const,
          text: `
❌ **Error Fetching Transactions**

Failed to retrieve transactions: ${error.message}

This could happen if:
- Your bank connection expired
- Plaid is experiencing issues
- The date range is invalid

Try reconnecting your bank or contact support.
          `.trim(),
        },
      ],
    };
  }
}

/**
 * Export storage map for use in download endpoint
 */
export { userTransactionData };
