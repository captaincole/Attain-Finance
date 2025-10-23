/**
 * Account Tool Handlers
 * MCP tool handlers for account connection management
 * Delegates business logic to account-service
 */

import { PlaidApi } from "plaid";
import {
  initiateAccountConnection,
  disconnectAccount,
} from "../../services/account-service.js";
import { getAccountsByUserId } from "../../storage/repositories/accounts.js";
import { getDemoInvestmentSnapshot } from "../../storage/demo/investments.js";
import { getDemoLiabilitySnapshot } from "../../storage/demo/liabilities.js";
import { isDemoInvestmentUser } from "../../demo-data/investments.js";

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
 * Get Account Balances Tool Handler
 * Shows current balances from database (fast, no API calls)
 */
export async function getAccountBalancesHandler(userId: string) {
  const realAccounts = await getAccountsByUserId(userId);
  let accounts = [...realAccounts];

  const syntheticConnections: any[] = [];

  if (isDemoInvestmentUser(userId)) {
    try {
      const demoSnapshot = await getDemoInvestmentSnapshot(userId);

      if (demoSnapshot.accounts.length > 0) {
        const now = new Date().toISOString();
        const demoItemId = `demo_investments_${userId}`;

        const demoAccounts = demoSnapshot.accounts.map((account) => ({
          id: `demo-${account.account_id}`,
          user_id: userId,
          item_id: demoItemId,
          account_id: account.account_id,
          name: account.name,
          official_name: account.name,
          type: account.type || "investment",
          subtype: account.subtype || "brokerage",
          current_balance: account.balances_current ?? 0,
          available_balance: account.balances_available ?? null,
          limit_amount: null,
          currency_code: account.currency_code || "USD",
          last_synced_at: account.last_synced_at || now,
          created_at: account.created_at || now,
          updated_at: account.updated_at || now,
        }));

        accounts = [...accounts, ...demoAccounts];

        syntheticConnections.push({
          userId,
          accessToken: "",
          itemId: demoItemId,
          connectedAt: new Date(demoAccounts[0].last_synced_at),
          environment: "sandbox" as const,
          institutionName: "Demo Investments",
          status: "active",
          errorCode: null,
          errorMessage: null,
        });
      }
    } catch (error) {
      console.warn("[ACCOUNTS] Failed to load demo investment snapshot", error);
    }

    try {
      const liabilitySnapshot = await getDemoLiabilitySnapshot(userId);

      if (liabilitySnapshot.accounts.length > 0) {
        const now = new Date().toISOString();
        const liabilityItemId = `demo_liabilities_${userId}`;

        const liabilityAccounts = liabilitySnapshot.accounts.map((account) => ({
          id: `demo-liability-${account.account_id}`,
          user_id: userId,
          item_id: liabilityItemId,
          account_id: account.account_id,
          name: account.name,
          official_name: account.name,
          type: account.type || "loan",
          subtype: account.subtype || undefined,
          current_balance: account.balances_current ?? 0,
          available_balance: account.balances_available ?? null,
          limit_amount: account.limit_amount ?? null,
          currency_code: account.currency_code || "USD",
          last_synced_at: account.last_synced_at || now,
          created_at: account.created_at || now,
          updated_at: account.updated_at || now,
        }));

        accounts = [...accounts, ...liabilityAccounts];

        syntheticConnections.push({
          userId,
          accessToken: "",
          itemId: liabilityItemId,
          connectedAt: new Date(liabilityAccounts[0].last_synced_at),
          environment: "sandbox" as const,
          institutionName: "Demo Liabilities",
          status: "active",
          errorCode: null,
          errorMessage: null,
        });
      }
    } catch (error) {
      console.warn("[ACCOUNTS] Failed to load demo liability snapshot", error);
    }
  }

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

  // Fetch connection details for status and institution names
  const { getUserConnections } = await import("../../services/account-service.js");
  const connections = await getUserConnections(userId);
  const augmentedConnections = [...connections, ...syntheticConnections];

  const connectionMap = new Map(augmentedConnections.map(c => [c.itemId, c]));

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

  // Build response text grouped by institution
  let responseText = `✓ **Account Balances** (${accounts.length} account${accounts.length > 1 ? "s" : ""})\n\n`;

  // Group accounts by item_id (institution)
  const accountsByInstitution = accounts.reduce((acc, account) => {
    const itemId = account.item_id;
    if (!acc[itemId]) {
      acc[itemId] = [];
    }
    acc[itemId].push(account);
    return acc;
  }, {} as Record<string, typeof accounts>);

  // Display each institution
  Object.entries(accountsByInstitution).forEach(([itemId, institutionAccounts]) => {
    const connection = connectionMap.get(itemId);
    const institutionName = connection?.institutionName || "Unknown Institution";
    const status = connection?.status || "unknown";

    // Status indicator
    const statusEmoji = status === 'active' ? '✓' : status === 'error' ? '⚠️' : '•';
    const statusText = status === 'active' ? '' : ` (${status})`;

    responseText += `${statusEmoji} **${institutionName}**${statusText}\n`;
    responseText += `Item ID: ${itemId}\n`;

    // Show error message if connection has errors
    if (status === 'error' && connection?.errorMessage) {
      responseText += `⚠️ Error: ${connection.errorMessage}\n`;
      responseText += `To fix: Say "Update account link for ${itemId}"\n\n`;
    } else {
      institutionAccounts.forEach((account) => {
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
      responseText += '\n';
    }
  });

  // Summary by account type
  responseText += `**Summary by Account Type:**\n`;
  Object.entries(accountsByType).forEach(([type, data]) => {
    responseText += `  ${type.charAt(0).toUpperCase() + type.slice(1)}: $${data.total.toFixed(2)}\n`;
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
  const institutions = Object.entries(accountsByInstitution).map(([itemId, institutionAccounts]) => {
    const connection = connectionMap.get(itemId);
    return {
      itemId,
      institutionName: connection?.institutionName || "Unknown Institution",
      status: connection?.status || "unknown",
      errorMessage: connection?.errorMessage || undefined,
      connectedAt: connection?.connectedAt || new Date(institutionAccounts[0].created_at),
      accounts: institutionAccounts.map(account => ({
        name: account.name,
        type: account.type,
        subtype: account.subtype || undefined,
        balances: {
          current: account.current_balance !== null ? Number(account.current_balance) : undefined
        }
      }))
    };
  });

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
