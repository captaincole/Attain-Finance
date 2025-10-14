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

**For Sandbox Testing (Demo Data):**
- Username: \`user_good\`
- Password: \`pass_good\`
- 2FA Code (if prompted): \`1234\`

**What happens next:**
1. You'll see a secure interface to select your financial institution
2. After connecting, the page will confirm success
3. Return here and say: "Show me my account balances"

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
