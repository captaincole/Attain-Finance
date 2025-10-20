/**
 * Account Service
 * Business logic for account connections and management
 * Orchestrates between Plaid API and database repositories
 */

import { PlaidApi, Products, CountryCode } from "plaid";
import crypto from "crypto";
import {
  AccountConnection,
  upsertAccountConnection,
  findAccountConnectionsByUserId,
  deleteAccountConnectionByItemId,
} from "../storage/repositories/account-connections.js";
import {
  createAccountSession,
  findAccountSessionById,
  markAccountSessionCompleted,
  cancelPendingSessionsForUser,
} from "../storage/repositories/account-sessions.js";
import {
  upsertAccounts,
  PlaidAccountData,
} from "../storage/repositories/accounts.js";
import { TransactionSyncService } from "./transaction-sync.js";
import { getSupabase } from "../storage/supabase.js";

/**
 * Initiate account connection flow
 * Returns a Plaid Link URL for the user to connect their account
 */
export async function initiateAccountConnection(
  userId: string,
  baseUrl: string,
  plaidClient: PlaidApi
): Promise<{ linkUrl: string; sessionId: string }> {
  // Cancel any existing pending sessions for this user
  // This prevents issues when user creates multiple connection attempts
  await cancelPendingSessionsForUser(userId);

  // Generate unique session ID
  const sessionId = crypto.randomUUID();

  // Store pending session (expires in 30 min)
  await createAccountSession(sessionId, userId);

  // Generate Plaid Link token
  const response = await plaidClient.linkTokenCreate({
    user: {
      client_user_id: userId,
    },
    client_name: "Personal Finance MCP",
    products: [
      Products.Transactions,
      Products.Investments,
      Products.Liabilities,
      Products.Assets,
      Products.Statements,
    ],
    transactions: {
      days_requested: 730, // 2 years of transaction history
    },
    country_codes: [CountryCode.Us],
    language: "en",
  });

  const linkToken = response.data.link_token;

  // Build Link URL
  const encodedLinkToken = encodeURIComponent(linkToken);
  const encodedSessionId = encodeURIComponent(sessionId);
  const linkUrl = `${baseUrl}/plaid/link?token=${encodedLinkToken}&session=${encodedSessionId}`;

  console.log("[ACCOUNT-SERVICE] Generated Link URL with session:", sessionId);

  return { linkUrl, sessionId };
}

/**
 * Complete account connection after Plaid Link callback
 * Exchanges public token for access token and stores connection
 */
export async function completeAccountConnection(
  sessionId: string,
  publicToken: string,
  plaidClient: PlaidApi
): Promise<{ userId: string; itemId: string }> {
  // Verify session exists and is valid
  const session = await findAccountSessionById(sessionId);
  if (!session) {
    throw new Error("Session not found or expired");
  }

  if (session.status !== "pending") {
    throw new Error(`Session already ${session.status}`);
  }

  // Exchange public token for access token
  const tokenResponse = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });

  const accessToken = tokenResponse.data.access_token;
  const itemId = tokenResponse.data.item_id;

  // Get environment from config
  const environment = (process.env.PLAID_ENV || "sandbox") as "sandbox" | "development" | "production";

  // Store connection
  await upsertAccountConnection(session.userId, accessToken, itemId, environment);

  // Fetch and store account balances immediately
  try {
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const plaidAccounts: PlaidAccountData[] = accountsResponse.data.accounts.map(
      (account) => ({
        account_id: account.account_id,
        name: account.name,
        official_name: account.official_name || null,
        type: account.type,
        subtype: account.subtype || null,
        balances: {
          current: account.balances.current,
          available: account.balances.available,
          limit: account.balances.limit || null,
          iso_currency_code: account.balances.iso_currency_code || null,
        },
      })
    );

    await upsertAccounts(session.userId, itemId, plaidAccounts);
    console.log(`[ACCOUNT-SERVICE] Stored ${plaidAccounts.length} accounts for item ${itemId}`);
  } catch (error: any) {
    console.error("[ACCOUNT-SERVICE] Failed to fetch/store account balances:", error.message);
    // Don't fail the entire connection if balance fetch fails
  }

  // Mark session as completed
  await markAccountSessionCompleted(sessionId);

  // Initiate transaction sync in background (fire-and-forget)
  // This runs after response is sent to avoid blocking OAuth callback
  setImmediate(async () => {
    try {
      console.log(`[ACCOUNT-SERVICE] Initiating background transaction sync for item ${itemId}`);
      const syncService = new TransactionSyncService(plaidClient, getSupabase());
      await syncService.initiateSyncForConnection(itemId, session.userId, accessToken);
      console.log(`[ACCOUNT-SERVICE] ✓ Background transaction sync completed for item ${itemId}`);
    } catch (error: any) {
      console.error(`[ACCOUNT-SERVICE] ✗ Background transaction sync failed for item ${itemId}:`, error.message);
      // Error is logged but does not affect OAuth callback response
    }
  });

  console.log("[ACCOUNT-SERVICE] Connection completed for user:", session.userId);

  return { userId: session.userId, itemId };
}

/**
 * Get all connections for a user with account details
 */
export async function getUserAccountsWithDetails(
  userId: string,
  plaidClient: PlaidApi
): Promise<{
  connections: AccountConnection[];
  accountDetails: Array<{
    itemId: string;
    institutionName: string;
    environment: string;
    connectedAt: Date;
    accounts: any[];
    error?: string;
  }>;
}> {
  const connections = await findAccountConnectionsByUserId(userId);

  const accountDetails = [];

  for (const connection of connections) {
    try {
      const accountsResponse = await plaidClient.accountsGet({
        access_token: connection.accessToken,
      });

      const envLabel =
        connection.environment === "sandbox"
          ? "🧪 Sandbox"
          : connection.environment === "development"
          ? "🔧 Development"
          : "✅ Production";

      const institutionName =
        accountsResponse.data.item.institution_name || "Unknown Institution";

      accountDetails.push({
        itemId: connection.itemId,
        institutionName,
        environment: envLabel,
        connectedAt: connection.connectedAt,
        accounts: accountsResponse.data.accounts,
      });
    } catch (error: any) {
      // Mark as error but continue processing other connections
      accountDetails.push({
        itemId: connection.itemId,
        institutionName: "Unknown Institution",
        environment: "⚠️ Error",
        connectedAt: connection.connectedAt,
        accounts: [],
        error: error.message,
      });
    }
  }

  return { connections, accountDetails };
}

/**
 * Disconnect an account
 */
export async function disconnectAccount(
  userId: string,
  itemId: string,
  plaidClient: PlaidApi
): Promise<void> {
  const connections = await findAccountConnectionsByUserId(userId);
  const connection = connections.find((c) => c.itemId === itemId);

  if (!connection) {
    throw new Error(`Connection with item ID "${itemId}" not found`);
  }

  if (connection.userId !== userId) {
    throw new Error("Unauthorized: connection belongs to different user");
  }

  try {
    // Invalidate token with Plaid
    await plaidClient.itemRemove({
      access_token: connection.accessToken,
    });
  } catch (error: any) {
    console.warn("[ACCOUNT-SERVICE] Plaid itemRemove error:", error.message);
    // Continue to delete from database even if Plaid API fails
  }

  // Delete from database
  await deleteAccountConnectionByItemId(itemId);

  console.log("[ACCOUNT-SERVICE] Account disconnected:", itemId);
}

/**
 * Get user connections (simple accessor)
 */
export async function getUserConnections(userId: string): Promise<AccountConnection[]> {
  return findAccountConnectionsByUserId(userId);
}
