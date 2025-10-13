import { PlaidApi } from "plaid";
import { generateSignedUrl } from "../../utils/signed-urls.js";
import { getConnections } from "../../storage/plaid/connections.js";
import { categorizeTransactions, TransactionForCategorization } from "../../utils/clients/claude.js";
import { getCustomRules } from "../../storage/categorization/rules.js";

interface GetTransactionsArgs {
  start_date?: string;
  end_date?: string;
}

// Storage for temporary transaction data (in-memory for MVP)
const userTransactionData = new Map<string, string>();

/**
 * Convert Plaid transactions to CSV format (with custom categories)
 * accountMap: Map<account_id, human_readable_name>
 * categorizedTxs: Map<description, custom_category> from Claude API
 */
function convertTransactionsToCSV(
  transactions: any[],
  accountMap: Map<string, string>,
  categorizedTxs?: Map<string, string>
): string {
  const headers = [
    "date",
    "description",
    "amount",
    "category",
    "custom_category",
    "account_name",
    "pending",
  ];

  const rows = transactions.map((tx) => {
    const accountName = accountMap.get(tx.account_id) || tx.account_id;
    const customCategory = categorizedTxs?.get(tx.name) || "";

    return [
      tx.date,
      `"${tx.name.replace(/"/g, '""')}"`, // Escape quotes in description
      tx.amount,
      tx.category ? `"${tx.category.join(", ")}"` : '""',
      `"${customCategory}"`,
      `"${accountName}"`,
      tx.pending ? "true" : "false",
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Get Plaid Transactions Tool
 * Fetches real transaction data from all connected Plaid accounts
 */
export async function getPlaidTransactionsHandler(
  userId: string,
  baseUrl: string,
  args: GetTransactionsArgs,
  plaidClient: PlaidApi
) {
  // Load all connections from database
  const connections = await getConnections(userId);

  if (connections.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `
⚠️ **No Bank Accounts Connected**

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

  // Categorize transactions using Claude API
  let categorizedMap: Map<string, string> | undefined;
  let categorizationError: string | null = null;

  try {
    console.log(`[CATEGORIZATION] Starting categorization for user ${userId}`);

    // Get user's custom categorization rules
    const customRules = await getCustomRules(userId);
    console.log(`[CATEGORIZATION] Custom rules: ${customRules ? 'Found' : 'None (using defaults)'}`);

    // Prepare transactions for categorization
    const txsForCategorization: TransactionForCategorization[] = allTransactions.map((tx) => ({
      date: tx.date,
      description: tx.name,
      amount: tx.amount.toString(),
      category: tx.category ? tx.category.join(", ") : undefined,
      account_name: accountMap.get(tx.account_id),
      pending: tx.pending ? "true" : "false",
    }));

    console.log(`[CATEGORIZATION] Prepared ${txsForCategorization.length} transactions`);
    console.log(`[CATEGORIZATION] Sample transaction:`, JSON.stringify(txsForCategorization[0], null, 2));

    // Call Claude API
    console.log(`[CATEGORIZATION] Calling Claude API...`);
    const categorized = await categorizeTransactions(txsForCategorization, customRules || undefined);
    console.log(`[CATEGORIZATION] Received ${categorized.length} categorized transactions`);
    console.log(`[CATEGORIZATION] Sample categorized:`, JSON.stringify(categorized[0], null, 2));

    // Build map: description -> custom_category
    categorizedMap = new Map();
    for (const tx of categorized) {
      categorizedMap.set(tx.description, tx.custom_category);
    }

    console.log(`[CATEGORIZATION] ✓ Successfully categorized ${categorized.length} transactions`);
    console.log(`[CATEGORIZATION] Map size: ${categorizedMap.size} entries`);
  } catch (error: any) {
    console.error("[CATEGORIZATION] ERROR:", error);
    console.error("[CATEGORIZATION] Error stack:", error.stack);
    categorizationError = error.message;
    // Continue without categorization
  }

  // Convert to CSV format with account names and custom categories
  const csvContent = convertTransactionsToCSV(allTransactions, accountMap, categorizedMap);

  // Generate signed download URL for transactions
  const transactionsUrl = generateSignedUrl(
    baseUrl,
    userId,
    "transactions",
    600 // 10 minute expiry
  );

  // Store CSV for download endpoint
  userTransactionData.set(userId, csvContent);

  let responseText = `📊 **Transactions Retrieved & Categorized**\n\nFound ${allTransactions.length} transactions from ${connections.length} institution(s)\n\n`;
  responseText += `**Date Range:**\n- Start: ${startDate.toISOString().split("T")[0]}\n- End: ${endDate.toISOString().split("T")[0]}\n\n`;

  // Show categorization status
  const customRules = await getCustomRules(userId);
  if (categorizedMap) {
    responseText += `✅ **AI Categorization:** Successfully categorized using ${customRules ? 'custom' : 'default'} rules\n\n`;
  } else if (categorizationError) {
    responseText += `⚠️ **Categorization Warning:** ${categorizationError}\nTransactions returned without custom categories.\n\n`;
  }

  if (errors.length > 0) {
    responseText += `**Warnings:**\n${errors.map(e => `- ${e}`).join('\n')}\n\n`;
  }

  responseText += `**Download Instructions:**\n\n\`\`\`bash\ncurl "${transactionsUrl}" -o transactions.csv\n\`\`\`\n\n`;
  responseText += `**Note:** Download link expires in 10 minutes.\n\n`;
  responseText += `**What you can do next:**\n- Visualize spending: Download and run \`./visualize-spending.sh transactions.csv\`\n- Track subscriptions: "Track my subscriptions"\n- Customize categories: "Put Amazon Prime in Business category"`;

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
export { userTransactionData };
