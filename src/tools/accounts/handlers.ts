/**
 * Account Tool Handlers
 * MCP tool handlers for account connection management
 * Delegates business logic to account-service
 */

import { PlaidApi } from "plaid";
import {
  initiateAccountConnection,
  getUserAccountsWithDetails,
  disconnectAccount,
  getUserConnections,
} from "../../services/account-service.js";
import { getAccountCapabilityHints, formatHintsForChatGPT } from "../../utils/capability-hints.js";
import { getAccountsByUserId } from "../../storage/repositories/accounts.js";

/**
 * Connect Account Tool Handler
 * Initiates account connection flow via Plaid Link
 */
export async function connectAccountHandler(
  userId: string,
  baseUrl: string,
  plaidClient: PlaidApi
) {
  try {
    const { linkUrl } = await initiateAccountConnection(userId, baseUrl, plaidClient);

    return {
      content: [
        {
          type: "text" as const,
          text: `
**Connect Your Account**

Click this link to securely connect your account:
${linkUrl}

**What happens next:**
1. You'll see a secure interface to select your financial institution
2. After connecting, the page will confirm success
3. Your account balances will be fetched and stored automatically
4. Return here and say: "Show me my account balances"

**Note:** This link expires in 30 minutes.
          `.trim(),
        },
      ],
    };
  } catch (error: any) {
    console.error("[CONNECT-ACCOUNT] Error:", error);

    const errorDetails = error.response?.data
      ? JSON.stringify(error.response.data, null, 2)
      : error.message;

    return {
      content: [
        {
          type: "text" as const,
          text: `
❌ **Error Creating Account Connection**

Failed to generate connection link.

**Error Details:**
\`\`\`
${errorDetails}
\`\`\`

**Common Issues:**
- Invalid API credentials
- Service environment mismatch (sandbox vs production)
- Missing required configuration

Please check your environment variables and try again.
          `.trim(),
        },
      ],
    };
  }
}

/**
 * Get Account Status Tool Handler
 * Shows user's connected accounts and current balances
 */
export async function getAccountStatusHandler(
  userId: string,
  plaidClient: PlaidApi
) {
  const { connections, accountDetails } = await getUserAccountsWithDetails(
    userId,
    plaidClient
  );

  if (connections.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `
❌ **No Accounts Connected**

You haven't connected any accounts yet.

To get started, say: "Connect my account"
          `.trim(),
        },
      ],
    };
  }

  // Build response text
  const totalAccounts = accountDetails.reduce(
    (sum, inst) => sum + inst.accounts.length,
    0
  );

  let responseText = `✓ **Connected Accounts (${connections.length} institution${
    connections.length > 1 ? "s" : ""
  })**\n\n`;

  accountDetails.forEach((inst) => {
    responseText += `**${inst.institutionName}** (${inst.environment})\n`;
    responseText += `Connected: ${inst.connectedAt.toLocaleString()}\n`;
    responseText += `Item ID: ${inst.itemId}\n`;

    if (inst.error) {
      responseText += `⚠️ Error: ${inst.error}\n`;
      responseText += `To fix: Say "Disconnect ${inst.itemId}"\n\n`;
    } else {
      responseText += `Accounts (${inst.accounts.length}):\n`;
      inst.accounts.forEach((acc) => {
        responseText += `  - ${acc.name} (${acc.subtype || acc.type}): $${
          acc.balances.current?.toFixed(2) || "N/A"
        }\n`;
      });
      responseText += "\n";
    }
  });

  responseText += `**Total Accounts:** ${totalAccounts}`;

  // Generate context-aware capability hints
  const allAccountTypes = accountDetails.flatMap((inst) =>
    inst.accounts.map((acc) => acc.type)
  );
  const capabilityHints = getAccountCapabilityHints(allAccountTypes);
  responseText += formatHintsForChatGPT(capabilityHints);

  return {
    content: [
      {
        type: "text" as const,
        text: responseText.trim(),
      },
    ],
    structuredContent: {
      institutions: accountDetails,
      totalAccounts,
    },
    _meta: {
      "openai/outputTemplate": "ui://widget/connected-institutions.html",
      "openai/widgetAccessible": true,
      "openai/resultCanProduceWidget": true,
    },
  };
}

/**
 * Get Account Balances Tool Handler
 * Shows current balances from database (fast, no API calls)
 */
export async function getAccountBalancesHandler(userId: string) {
  const accounts = await getAccountsByUserId(userId);

  if (accounts.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `
❌ **No Accounts Found**

You haven't connected any accounts yet.

To get started, say: "Connect my account"
          `.trim(),
        },
      ],
    };
  }

  // Calculate totals by account type
  const accountsByType = accounts.reduce((acc, account) => {
    const type = account.type;
    if (!acc[type]) {
      acc[type] = { accounts: [], total: 0 };
    }
    acc[type].accounts.push(account);
    if (account.current_balance !== null) {
      acc[type].total += Number(account.current_balance);
    }
    return acc;
  }, {} as Record<string, { accounts: any[]; total: number }>);

  // Build response text
  let responseText = `✓ **Account Balances** (${accounts.length} account${accounts.length > 1 ? "s" : ""})\n\n`;

  // Group by type
  Object.entries(accountsByType).forEach(([type, data]) => {
    responseText += `**${type.charAt(0).toUpperCase() + type.slice(1)} Accounts:**\n`;
    data.accounts.forEach((account) => {
      const balance = account.current_balance !== null
        ? `$${Number(account.current_balance).toFixed(2)}`
        : "N/A";
      const available = account.available_balance !== null
        ? ` (Available: $${Number(account.available_balance).toFixed(2)})`
        : "";
      responseText += `  • ${account.name}${account.subtype ? ` (${account.subtype})` : ""}: ${balance}${available}\n`;

      // Show credit limit if applicable
      if (account.limit_amount !== null) {
        responseText += `    Credit Limit: $${Number(account.limit_amount).toFixed(2)}\n`;
      }
    });
    responseText += `  **Total:** $${data.total.toFixed(2)}\n\n`;
  });

  // Calculate net worth (assets - liabilities)
  const assets = ["depository", "investment"].reduce((sum, type) =>
    sum + (accountsByType[type]?.total || 0), 0);
  const liabilities = ["credit", "loan"].reduce((sum, type) =>
    sum + Math.abs(accountsByType[type]?.total || 0), 0);
  const netWorth = assets - liabilities;

  responseText += `**Net Worth:** $${netWorth.toFixed(2)}\n`;

  // Add last synced info
  const oldestSync = accounts.reduce((oldest, account) => {
    const syncDate = new Date(account.last_synced_at);
    return !oldest || syncDate < oldest ? syncDate : oldest;
  }, null as Date | null);

  if (oldestSync) {
    responseText += `\n*Last synced: ${oldestSync.toLocaleString()}*\n`;
    responseText += `*To update balances, say: "Refresh my transactions"*`;
  }

  // Transform data for widget compatibility
  // Widget expects institutions array grouped by item_id
  const institutionMap = new Map<string, {
    itemId: string;
    institutionName: string;
    env: string;
    connectedAt: Date;
    accounts: Array<{
      name: string;
      type: string;
      subtype?: string;
      balances: { current?: number };
    }>;
  }>();

  accounts.forEach(account => {
    if (!institutionMap.has(account.item_id)) {
      institutionMap.set(account.item_id, {
        itemId: account.item_id,
        institutionName: "Connected Institution", // Placeholder - institution name not stored in accounts table
        env: "production", // Could be enriched from connection data
        connectedAt: new Date(account.created_at),
        accounts: []
      });
    }

    const institution = institutionMap.get(account.item_id)!;
    institution.accounts.push({
      name: account.name,
      type: account.type,
      subtype: account.subtype || undefined,
      balances: {
        current: account.current_balance !== null ? Number(account.current_balance) : undefined
      }
    });
  });

  const institutions = Array.from(institutionMap.values());

  return {
    content: [
      {
        type: "text" as const,
        text: responseText.trim(),
      },
    ],
    structuredContent: {
      institutions,
      totalAccounts: accounts.length,
      // Keep original data for backwards compatibility
      accounts,
      summary: {
        totalAccounts: accounts.length,
        accountsByType,
        netWorth,
        lastSynced: oldestSync?.toISOString(),
      },
    },
  };
}

/**
 * Disconnect Account Tool Handler
 * Removes a connection and invalidates the access token
 */
export async function disconnectAccountHandler(
  userId: string,
  itemId: string,
  plaidClient: PlaidApi
) {
  const connections = await getUserConnections(userId);

  if (connections.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `
❌ **No Accounts Connected**

You don't have any connected accounts to disconnect.
          `.trim(),
        },
      ],
    };
  }

  const connection = connections.find((c) => c.itemId === itemId);

  if (!connection) {
    let responseText = `❌ **Account Not Found**\n\nItem ID "${itemId}" not found in your connections.\n\n`;
    responseText += `**Your Connected Accounts:**\n`;
    connections.forEach((conn, index) => {
      responseText += `${index + 1}. ${conn.itemId} (connected ${conn.connectedAt.toLocaleDateString()})\n`;
    });
    responseText += `\nTo disconnect, use one of the Item IDs listed above.`;

    return {
      content: [
        {
          type: "text" as const,
          text: responseText.trim(),
        },
      ],
    };
  }

  try {
    await disconnectAccount(userId, itemId, plaidClient);

    return {
      content: [
        {
          type: "text" as const,
          text: `
✓ **Account Disconnected**

Successfully disconnected and invalidated access token for:
**Item ID:** ${itemId}

Your financial data from this account has been removed.

**What's next:**
- Check remaining connections: "Show my account balances"
- Connect another account: "Connect my account"
          `.trim(),
        },
      ],
    };
  } catch (error: any) {
    console.error("[DISCONNECT-ACCOUNT] Error:", error);

    return {
      content: [
        {
          type: "text" as const,
          text: `
❌ **Disconnect Failed**

Failed to disconnect account: ${error.message}

Please try again or contact support if this issue persists.
          `.trim(),
        },
      ],
    };
  }
}
