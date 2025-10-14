import { PlaidApi } from "plaid";
import { generateSignedUrl } from "../../utils/signed-urls.js";
import { findAccountConnectionsByUserId } from "../../storage/repositories/account-connections.js";

interface GetRawTransactionsArgs {
  start_date?: string;
  end_date?: string;
}

// Storage for temporary raw transaction data (in-memory for MVP)
const userRawTransactionData = new Map<string, string>();

/**
 * Convert Plaid transactions to CSV format (raw data, no categorization)
 * accountMap: Map<account_id, human_readable_name>
 */
function convertRawTransactionsToCSV(
  transactions: any[],
  accountMap: Map<string, string>
): string {
  const headers = [
    "date",
    "description",
    "amount",
    "plaid_category",
    "account_name",
    "pending",
    "transaction_id",
  ];

  const rows = transactions.map((tx) => {
    const accountName = accountMap.get(tx.account_id) || tx.account_id;

    return [
      tx.date,
      `"${tx.name.replace(/"/g, '""')}"`, // Escape quotes in description
      tx.amount,
      tx.category ? `"${tx.category.join(", ")}"` : '""',
      `"${accountName}"`,
      tx.pending ? "true" : "false",
      `"${tx.transaction_id}"`,
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Get Raw Plaid Transactions Tool
 * Fetches transaction data WITHOUT AI categorization (pure data extraction)
 */
export async function getRawTransactionsHandler(
  userId: string,
  baseUrl: string,
  args: GetRawTransactionsArgs,
  plaidClient: PlaidApi
) {
  // Load all connections from database
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

  // Fetch transactions from all connections and build account name map
  const allTransactions: any[] = [];
  const errors: string[] = [];
  const accountMap = new Map<string, string>(); // account_id -> readable name

  for (const connection of connections) {
    try {
      // Get account details for this connection
      const accountsResponse = await plaidClient.accountsGet({
        access_token: connection.accessToken,
      });

      const institutionName = accountsResponse.data.item.institution_name || "Unknown";

      // Build account name map: "Institution - Account Type (****1234)"
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
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        options: {
          count: 500,
          offset: 0,
        },
      });

      allTransactions.push(...response.data.transactions);
    } catch (error: any) {
      errors.push(`${connection.itemId}: ${error.message}`);
    }
  }

  if (allTransactions.length === 0) {
    let errorMsg = `📊 **No Transactions Found**\n\nNo transactions found for the period:\n- Start: ${startDate.toISOString().split("T")[0]}\n- End: ${endDate.toISOString().split("T")[0]}`;

    if (errors.length > 0) {
      errorMsg += `\n\n**Errors:**\n${errors.map(e => `- ${e}`).join('\n')}`;
    }

    return {
      content: [
        {
          type: "text" as const,
          text: errorMsg.trim(),
        },
      ],
    };
  }

  // Sort transactions by date (newest first)
  allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Convert to CSV format with account names (NO AI categorization)
  const csvContent = convertRawTransactionsToCSV(allTransactions, accountMap);

  // Store CSV for download endpoint
  userRawTransactionData.set(userId, csvContent);

  // Generate signed download URL
  const transactionsUrl = generateSignedUrl(
    baseUrl,
    userId,
    "raw-transactions",
    600 // 10 minute expiry
  );

  let responseText = `📊 **Raw Transaction Data Retrieved**\n\nFound ${allTransactions.length} transactions from ${connections.length} institution(s)\n\n`;
  responseText += `**Date Range:**\n- Start: ${startDate.toISOString().split("T")[0]}\n- End: ${endDate.toISOString().split("T")[0]}\n\n`;

  if (errors.length > 0) {
    responseText += `**Warnings:**\n${errors.map(e => `- ${e}`).join('\n')}\n\n`;
  }

  responseText += `**CSV Format:**\n- date, description, amount, plaid_category, account_name, pending, transaction_id\n\n`;

  // Provide clickable download link
  responseText += `**Download CSV:**\n[Download raw-transactions.csv](${transactionsUrl})\n\n`;

  responseText += `**Note:** Download link expires in 10 minutes.\n\n`;
  responseText += `**Next Steps:**\n- For categorized analysis, use: "Show me my spending breakdown by category"\n- For visualization, use: "Visualize my spending"`;

  return {
    content: [
      {
        type: "text" as const,
        text: responseText.trim(),
      },
    ],
  };
}

/**
 * Export storage map for use in download endpoint
 */
export { userRawTransactionData };
