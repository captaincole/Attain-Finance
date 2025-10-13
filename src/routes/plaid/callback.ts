/**
 * Plaid Callback Route Handler
 * Handles automatic token exchange after Plaid Link completes
 */

import { Request, Response } from "express";
import { PlaidApi } from "plaid";
import { saveConnection } from "../../storage/plaid/connections.js";
import { getSession, completeSession, failSession } from "../../storage/plaid/sessions.js";

/**
 * POST /plaid/callback
 * Exchanges public_token for access_token and saves connection
 */
export async function plaidCallbackHandler(
  req: Request,
  res: Response,
  plaidClient: PlaidApi
) {
  const { public_token, session, metadata } = req.body;

  console.log("Plaid callback received:", {
    hasPublicToken: !!public_token,
    session,
    sessionLength: session?.length,
    sessionType: typeof session,
  });

  if (!public_token || !session) {
    console.error("Missing required fields:", { public_token: !!public_token, session });
    return res.status(400).json({ error: "Missing public_token or session" });
  }

  // Verify session exists in database and get userId
  const sessionData = await getSession(session);

  console.log("Session lookup from database:", {
    receivedSession: session,
    found: !!sessionData,
    userId: sessionData?.user_id,
    status: sessionData?.status,
  });

  if (!sessionData) {
    return res.status(400).json({ error: "Invalid or expired session" });
  }

  if (sessionData.status === "completed") {
    return res.status(400).json({ error: "Session already completed" });
  }

  const userId = sessionData.user_id;

  try {
    // Exchange public_token for access_token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Fetch account details for response
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accounts = accountsResponse.data.accounts;

    // Save to database (encrypted)
    await saveConnection(userId, accessToken, itemId);

    // Mark session as completed in database
    await completeSession(session);

    console.log(`✓ Bank connected for user ${userId}: ${itemId}`);

    // Return success
    res.json({
      success: true,
      item_id: itemId,
      accounts: accounts.map((acc) => ({
        name: acc.name,
        type: acc.type,
      })),
    });
  } catch (error: any) {
    console.error("Error exchanging public token:", error);
    await failSession(session, error.message);

    res.status(500).json({
      error: "Failed to connect bank account",
      details: error.message,
    });
  }
}
