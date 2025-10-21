/**
 * Update Account Link Tool Handler
 * Generates Plaid Link URL for re-authenticating broken connections (update mode)
 */

import { PlaidApi } from "plaid";
import { initiateAccountUpdate } from "../../services/account-service.js";

/**
 * Update Account Link Tool Handler
 * Called by update-account-link tool
 */
export async function updateAccountLinkHandler(
  userId: string,
  itemId: string,
  baseUrl: string,
  plaidClient: PlaidApi
) {
  try {
    const { linkUrl } = await initiateAccountUpdate(userId, itemId, baseUrl, plaidClient);

    return {
      content: [
        {
          type: "text" as const,
          text: `
**Update Your Account Connection**

Click this link to re-authenticate your account:
${linkUrl}

**What happens next:**
1. You'll be prompted to re-enter your credentials or complete required authentication
2. The page will confirm when the update is complete
3. Return here and say: **"I've updated it, please refresh my transactions"**

**Note:** This link expires in 30 minutes.
          `.trim(),
        },
      ],
    };
  } catch (error: any) {
    console.error("[UPDATE-ACCOUNT-LINK] Error:", error);

    const errorDetails = error.message || "Unknown error";

    return {
      content: [
        {
          type: "text" as const,
          text: `
❌ **Error Updating Account Link**

Failed to generate update link for item: ${itemId}

**Error Details:**
${errorDetails}

**Common Issues:**
- Item ID not found or doesn't belong to your account
- Connection has already been removed
- Invalid Plaid credentials

To see your connected accounts, say: "Show me my account balances"
          `.trim(),
        },
      ],
    };
  }
}
