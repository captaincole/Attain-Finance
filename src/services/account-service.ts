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
import { ClaudeClient } from "../utils/clients/claude.js";
import { logServiceEvent, serializeError } from "../utils/logger.js";
import { upsertHoldingsForAccount } from "../storage/repositories/investment-holdings.js";

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
    products: [Products.Assets],
    required_if_supported_products: [
      Products.Transactions,
      Products.Investments,
      Products.Liabilities
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

  logServiceEvent("account-service", "link-session-generated", {
    userId,
    sessionId,
  });

  return { linkUrl, sessionId };
}

/**
 * Complete account connection after Plaid Link callback
 * Exchanges public token for access token and stores connection
 */
export async function completeAccountConnection(
  sessionId: string,
  publicToken: string,
  plaidClient: PlaidApi,
  claudeClient?: ClaudeClient
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

  // Fetch institution name from Plaid
  let institutionName: string | undefined;
  try {
    const itemResponse = await plaidClient.itemGet({
      access_token: accessToken,
    });
    institutionName = itemResponse.data.item.institution_name || undefined;
  } catch (error: any) {
    logServiceEvent("account-service", "institution-name-fetch-failed", { error: serializeError(error) }, "warn");
    // Continue without institution name
  }

  // Store connection
  await upsertAccountConnection(session.userId, accessToken, itemId, environment, institutionName);

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
    logServiceEvent("account-service", "accounts-stored", {
      userId: session.userId,
      itemId,
      accountCount: plaidAccounts.length,
    });
  } catch (error: any) {
    logServiceEvent(
      "account-service",
      "accounts-store-error",
      { userId: session.userId, itemId, error: serializeError(error) },
      "error"
    );
    // Don't fail the entire connection if balance fetch fails
  }

  // Mark session as completed
  await markAccountSessionCompleted(sessionId);

  // Initiate transaction sync in background (fire-and-forget)
  // This runs after response is sent to avoid blocking OAuth callback
  setImmediate(async () => {
    try {
      logServiceEvent("account-service", "background-sync-start", {
        userId: session.userId,
        itemId,
      });
      const syncService = new TransactionSyncService(plaidClient, getSupabase(), claudeClient);
      await syncService.initiateSyncForConnection(itemId, session.userId, accessToken);
      logServiceEvent("account-service", "background-sync-complete", {
        userId: session.userId,
        itemId,
      });
    } catch (error: any) {
      logServiceEvent(
        "account-service",
        "background-sync-error",
        { userId: session.userId, itemId, error: serializeError(error) },
        "error"
      );
      // Error is logged but does not affect OAuth callback response
    }
  });

  // Sync investment holdings in background if investment accounts detected
  setImmediate(async () => {
    try {
      // Check if any accounts are investment type
      const accountsResponse = await plaidClient.accountsGet({
        access_token: accessToken,
      });

      const hasInvestmentAccounts = accountsResponse.data.accounts.some(
        (acc) => acc.type === "investment"
      );

      if (!hasInvestmentAccounts) {
        logServiceEvent("account-service", "no-investment-accounts", {
          userId: session.userId,
          itemId,
        });
        return;
      }

      logServiceEvent("account-service", "investment-sync-start", {
        userId: session.userId,
        itemId,
      });

      // Fetch holdings from Plaid
      const holdingsResponse = await plaidClient.investmentsHoldingsGet({
        access_token: accessToken,
      });

      // Store holdings for each investment account
      for (const account of holdingsResponse.data.accounts) {
        if (account.type === "investment") {
          const accountHoldings = holdingsResponse.data.holdings.filter(
            (h) => h.account_id === account.account_id
          );

          await upsertHoldingsForAccount(
            session.userId,
            account.account_id,
            accountHoldings,
            holdingsResponse.data.securities
          );

          logServiceEvent("account-service", "investment-holdings-stored", {
            userId: session.userId,
            accountId: account.account_id,
            holdingsCount: accountHoldings.length,
          });
        }
      }

      logServiceEvent("account-service", "investment-sync-complete", {
        userId: session.userId,
        itemId,
      });
    } catch (error: any) {
      logServiceEvent(
        "account-service",
        "investment-sync-error",
        { userId: session.userId, itemId, error: serializeError(error) },
        "error"
      );
      // Error is logged but does not affect OAuth callback response
    }
  });

  logServiceEvent("account-service", "connection-completed", {
    userId: session.userId,
    itemId,
  });

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
    logServiceEvent(
      "account-service",
      "plaid-item-remove-error",
      { itemId, error: serializeError(error) },
      "warn"
    );
    // Continue to delete from database even if Plaid API fails
  }

  // Delete from database
  await deleteAccountConnectionByItemId(itemId);
  logServiceEvent("account-service", "account-disconnected", { userId, itemId });
}

/**
 * Get user connections (simple accessor)
 */
export async function getUserConnections(userId: string): Promise<AccountConnection[]> {
  return findAccountConnectionsByUserId(userId);
}

/**
 * Initiate account update flow (Plaid update mode)
 * Returns a Plaid Link URL for the user to re-authenticate their connection
 */
export async function initiateAccountUpdate(
  userId: string,
  itemId: string,
  baseUrl: string,
  plaidClient: PlaidApi
): Promise<{ linkUrl: string }> {
  logServiceEvent("account-service", "update-init", { userId, itemId });

  // Verify user owns this connection
  const connections = await findAccountConnectionsByUserId(userId);
  const connection = connections.find((c) => c.itemId === itemId);

  if (!connection) {
    throw new Error(`Connection with item ID "${itemId}" not found`);
  }

  if (connection.userId !== userId) {
    throw new Error("Unauthorized: connection belongs to different user");
  }

  // Generate Plaid Link token for update mode
  // Note: Must include access_token to enable update mode
  const response = await plaidClient.linkTokenCreate({
    user: {
      client_user_id: userId,
    },
    client_name: "Personal Finance MCP",
    access_token: connection.accessToken,
    country_codes: [CountryCode.Us],
    language: "en",
  });

  const linkToken = response.data.link_token;

  // Build Link URL (simpler than new connections - no session needed)
  const encodedLinkToken = encodeURIComponent(linkToken);
  const linkUrl = `${baseUrl}/plaid/link?token=${encodedLinkToken}`;

  logServiceEvent("account-service", "update-link-generated", { userId, itemId });

  return { linkUrl };
}
