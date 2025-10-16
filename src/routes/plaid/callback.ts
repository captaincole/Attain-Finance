/**
 * Plaid Callback Route Handler
 * Handles automatic token exchange after Plaid Link completes
 */

import { Request, Response } from "express";
import { PlaidApi } from "plaid";
import { completeAccountConnection } from "../../services/account-service.js";
import { getAccountsByItemId } from "../../storage/repositories/accounts.js";

/**
 * POST /plaid/callback
 * Exchanges public_token for access_token and saves connection
 */
export async function plaidCallbackHandler(
  req: Request,
  res: Response,
  plaidClient: PlaidApi
) {
  const { public_token, session } = req.body;

  console.log("[PLAID-CALLBACK] Received:", {
    hasPublicToken: !!public_token,
    session,
  });

  if (!public_token || !session) {
    console.error("[PLAID-CALLBACK] Missing required fields");
    return res.status(400).json({ error: "Missing public_token or session" });
  }

  try {
    // Complete connection via service layer (handles everything)
    const { userId, itemId } = await completeAccountConnection(
      session,
      public_token,
      plaidClient
    );

    console.log(`[PLAID-CALLBACK] ✓ Bank connected for user ${userId}: ${itemId}`);

    // Fetch the accounts that were just stored
    const accounts = await getAccountsByItemId(userId, itemId);

    // Return success with account details
    res.json({
      success: true,
      item_id: itemId,
      accounts: accounts.map(acc => ({
        name: acc.name,
        type: acc.type,
        subtype: acc.subtype,
        current_balance: acc.current_balance,
        available_balance: acc.available_balance,
      })),
      message: "Account connected successfully! Return to ChatGPT and say 'Show me my account balances' to view your accounts.",
    });
  } catch (error: any) {
    console.error("[PLAID-CALLBACK] Error:", error.message);

    res.status(500).json({
      error: "Failed to connect bank account",
      details: error.message,
    });
  }
}
