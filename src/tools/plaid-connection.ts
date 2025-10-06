import { PlaidApi, Products, CountryCode } from "plaid";
import crypto from "crypto";
import { getConnection, deleteConnection } from "../db/plaid-storage.js";

interface PendingConnection {
  userId: string;
  createdAt: Date;
  status: "pending" | "completed" | "failed";
  completedAt?: Date;
  error?: string;
}

/**
 * Connect Financial Institution Tool
 * Initiates Plaid Link flow for user to connect their bank account
 */
export async function connectFinancialInstitutionHandler(
  userId: string,
  baseUrl: string,
  plaidClient: PlaidApi,
  pendingConnections: Map<string, PendingConnection>
) {
  // Generate unique session ID for this connection attempt
  const sessionId = crypto.randomUUID();

  // Store pending connection (expires in 30 min)
  pendingConnections.set(sessionId, {
    userId,
    createdAt: new Date(),
    status: "pending",
  });

  console.log(`Created Plaid session ${sessionId} for user ${userId}`);

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
    // Clean up pending connection on error
    pendingConnections.delete(sessionId);

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
 * Verifies if user has connected a bank account
 */
export async function checkConnectionStatusHandler(
  userId: string,
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
❌ **No Bank Connected**

You haven't connected a bank account yet.

To connect, say: "Connect my bank account"
          `.trim(),
        },
      ],
    };
  }

  // Verify connection is still valid by fetching accounts
  try {
    const accountsResponse = await plaidClient.accountsGet({
      access_token: connection.accessToken,
    });

    const accounts = accountsResponse.data.accounts;

    return {
      content: [
        {
          type: "text" as const,
          text: `
✓ **Bank Connected**

**Connected:** ${connection.connectedAt.toLocaleString()}
**Item ID:** ${connection.itemId}

**Accounts (${accounts.length}):**
${accounts
  .map(
    (acc) =>
      `- ${acc.name} (${acc.subtype || acc.type}): $${
        acc.balances.current?.toFixed(2) || "N/A"
      }`
  )
  .join("\n")}

**Available Commands:**
- "Get my recent transactions"
- "Track my subscriptions"
- "Show my account balances"
          `.trim(),
        },
      ],
    };
  } catch (error: any) {
    // Token might be invalid/expired - delete from database
    await deleteConnection(userId);

    return {
      content: [
        {
          type: "text" as const,
          text: `
⚠️ **Connection Expired**

Your bank connection has expired or been revoked.

Error: ${error.message}

Please reconnect by saying: "Connect my bank account"
          `.trim(),
        },
      ],
    };
  }
}
