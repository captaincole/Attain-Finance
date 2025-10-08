import { PlaidApi, Products, CountryCode } from "plaid";
import crypto from "crypto";
import { getConnections, deleteConnectionByItemId } from "../db/plaid-storage.js";
import { createSession } from "../db/plaid-sessions.js";

/**
 * Connect Financial Institution Tool
 * Initiates Plaid Link flow for user to connect their bank account
 */
export async function connectFinancialInstitutionHandler(
  userId: string,
  baseUrl: string,
  plaidClient: PlaidApi
) {
  // Generate unique session ID for this connection attempt
  const sessionId = crypto.randomUUID();

  // Store pending session in database (expires in 30 min)
  await createSession(sessionId, userId);

  try {
    // Generate link_token
    // Note: redirect_uri removed because it requires dashboard configuration
    // We handle the callback via JavaScript fetch instead of browser redirect
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: userId,
      },
      client_name: "Personal Finance MCP",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    const linkToken = response.data.link_token;

    // URL encode parameters to preserve full session ID
    const encodedLinkToken = encodeURIComponent(linkToken);
    const encodedSessionId = encodeURIComponent(sessionId);
    const linkUrl = `${baseUrl}/plaid/link?token=${encodedLinkToken}&session=${encodedSessionId}`;

    console.log(`Generated Plaid Link URL with session: ${sessionId}`);

    return {
      content: [
        {
          type: "text" as const,
          text: `
**Connect Your Bank Account**

Click this link to securely connect your bank:
${linkUrl}

**For Sandbox Testing (Fake Bank Data):**
- Username: \`user_good\`
- Password: \`pass_good\`
- 2FA Code (if prompted): \`1234\`

**What happens next:**
1. You'll see a secure Plaid interface to select your bank
2. After connecting, the page will confirm success
3. Return here and say: "Check my connection status"

**Note:** This link expires in 30 minutes.
          `.trim(),
        },
      ],
    };
  } catch (error: any) {
    // Log detailed error for debugging
    console.error("Plaid linkTokenCreate error:", error.response?.data || error.message);

    const errorDetails = error.response?.data
      ? JSON.stringify(error.response.data, null, 2)
      : error.message;

    return {
      content: [
        {
          type: "text" as const,
          text: `
❌ **Error Creating Bank Connection**

Failed to generate connection link.

**Error Details:**
\`\`\`
${errorDetails}
\`\`\`

**Common Issues:**
- Invalid Plaid client_id or secret
- Plaid environment mismatch (sandbox vs production)
- Missing required fields in link token request

**Check your .env file:**
- PLAID_CLIENT_ID should match your Plaid dashboard
- PLAID_SECRET should be your sandbox secret
- PLAID_ENV should be "sandbox"
          `.trim(),
        },
      ],
    };
  }
}

/**
 * Check Connection Status Tool
 * Verifies if user has connected bank accounts
 */
export async function checkConnectionStatusHandler(
  userId: string,
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
❌ **No Banks Connected**

You haven't connected any bank accounts yet.

To connect, say: "Connect my bank account"
          `.trim(),
        },
      ],
    };
  }

  // Fetch accounts for all connections
  const institutionData: Array<{
    itemId: string;
    institutionName: string;
    env: string;
    connectedAt: Date;
    accounts: any[];
    error?: string;
  }> = [];

  for (const connection of connections) {
    try {
      const accountsResponse = await plaidClient.accountsGet({
        access_token: connection.accessToken,
      });

      const envLabel = connection.plaidEnv === 'sandbox'
        ? '🧪 Sandbox'
        : connection.plaidEnv === 'development'
        ? '🔧 Development'
        : '✅ Production';

      // Get institution name from Plaid API response
      const institutionName = accountsResponse.data.item.institution_name || "Unknown Institution";

      institutionData.push({
        itemId: connection.itemId,
        institutionName,
        env: envLabel,
        connectedAt: connection.connectedAt,
        accounts: accountsResponse.data.accounts,
      });
    } catch (error: any) {
      // Mark as error but continue processing other connections
      institutionData.push({
        itemId: connection.itemId,
        institutionName: "Unknown Institution",
        env: '⚠️ Error',
        connectedAt: connection.connectedAt,
        accounts: [],
        error: error.message,
      });
    }
  }

  // Build response
  const totalAccounts = institutionData.reduce((sum, inst) => sum + inst.accounts.length, 0);

  let responseText = `✓ **Connected Institutions (${connections.length})**\n\n`;

  institutionData.forEach((inst, index) => {
    responseText += `**${inst.institutionName}** (${inst.env})\n`;
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
      responseText += '\n';
    }
  });

  responseText += `**Total Accounts:** ${totalAccounts}\n\n`;
  responseText += `**Available Commands:**\n`;
  responseText += `- "Get my recent transactions"\n`;
  responseText += `- "Track my subscriptions"\n`;
  responseText += `- "Connect another bank"`;

  return {
    content: [
      {
        type: "text" as const,
        text: responseText.trim(),
      },
    ],
    structuredContent: {
      institutions: institutionData,
      totalAccounts,
    },
    _meta: {
      "openai/outputTemplate": "ui://widget/connected-institutions.html"
    }
  };
}

/**
 * Disconnect Financial Institution Tool
 * Removes a Plaid connection and invalidates the access token
 */
export async function disconnectFinancialInstitutionHandler(
  userId: string,
  itemId: string,
  plaidClient: PlaidApi
) {
  // Get all connections for the user
  const connections = await getConnections(userId);

  // Find the connection to disconnect
  const connection = connections.find((conn) => conn.itemId === itemId);

  if (!connection) {
    // Check if user has any connections at all
    if (connections.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `
❌ **No Banks Connected**

You don't have any connected banks to disconnect.
            `.trim(),
          },
        ],
      };
    }

    // User has connections but specified wrong item ID
    let responseText = `❌ **Institution Not Found**\n\nItem ID "${itemId}" not found in your connections.\n\n`;
    responseText += `**Your Connected Institutions:**\n`;
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

  // Verify the connection belongs to this user (security check)
  if (connection.userId !== userId) {
    return {
      content: [
        {
          type: "text" as const,
          text: `
⛔ **Unauthorized**

You don't have permission to disconnect this institution.
          `.trim(),
        },
      ],
    };
  }

  try {
    // Call Plaid API to invalidate the access token
    await plaidClient.itemRemove({
      access_token: connection.accessToken,
    });

    // Delete from our database
    await deleteConnectionByItemId(itemId);

    return {
      content: [
        {
          type: "text" as const,
          text: `
✓ **Institution Disconnected**

Successfully disconnected and invalidated access token for:
**Item ID:** ${itemId}

Your financial data from this institution has been removed.

**What's next:**
- Check remaining connections: "Check connection status"
- Connect another bank: "Connect my bank account"
          `.trim(),
        },
      ],
    };
  } catch (error: any) {
    // Even if Plaid API fails, still delete from our database
    // (token might already be invalid on Plaid's side)
    try {
      await deleteConnectionByItemId(itemId);

      return {
        content: [
          {
            type: "text" as const,
            text: `
⚠️ **Partially Disconnected**

Removed from our database, but Plaid returned an error:
${error.message}

The connection has been removed from our system. If you're still seeing
this institution in Plaid, you may need to revoke access through their dashboard.
            `.trim(),
          },
        ],
      };
    } catch (dbError: any) {
      return {
        content: [
          {
            type: "text" as const,
            text: `
❌ **Disconnect Failed**

Failed to disconnect institution:
- Plaid error: ${error.message}
- Database error: ${dbError.message}

Please contact support if this issue persists.
            `.trim(),
          },
        ],
      };
    }
  }
}
