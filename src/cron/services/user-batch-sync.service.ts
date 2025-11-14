/**
 * User Batch Sync Service
 * Reusable service for syncing operations across all users
 * Handles user fetching, error isolation, and progress tracking
 */

import { getSupabaseServiceRole } from "../../storage/supabase.js";
import {
  findAccountConnectionsByUserId,
  AccountConnection,
} from "../../storage/repositories/account-connections.js";
import { logBatchOperation, logEvent } from "../../utils/logger.js";

export interface UserSyncOptions {
  /**
   * Function to execute for each user's connection
   */
  syncFn: (userId: string, connection: AccountConnection) => Promise<void>;

  /**
   * Whether to run syncs in parallel (default: false)
   */
  parallel?: boolean;

  /**
   * Filter connections by Plaid environment
   * If specified, only syncs connections from this environment
   */
  environment?: "sandbox" | "development" | "production";

  /**
   * Whether to fail the entire job when any user sync fails (default: true)
   * Set to false in tests to avoid process.exit side effects.
   */
  failOnError?: boolean;
}

export class UserBatchSyncService {
  private readonly ignoredUserIds = new Set(
    (process.env.CRON_IGNORE_USER_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
  /**
   * Get all unique user IDs from plaid_connections table
   * Optionally filter by Plaid environment
   */
  private async getAllUserIds(
    environment?: "sandbox" | "development" | "production"
  ): Promise<string[]> {
    let query = getSupabaseServiceRole().from("plaid_connections").select("user_id");

    // Filter by environment if specified
    if (environment) {
      query = query.eq("plaid_env", environment);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }

    // Get unique user IDs
    const uniqueUserIds = [...new Set(data.map((row) => row.user_id))];
    if (this.ignoredUserIds.size === 0) {
      return uniqueUserIds;
    }

    const filtered = uniqueUserIds.filter((userId) => !this.ignoredUserIds.has(userId));
    if (uniqueUserIds.length !== filtered.length) {
      logEvent("CRON:batch-sync", "ignored-demo-users", {
        ignoredCount: uniqueUserIds.length - filtered.length,
      });
    }
    return filtered;
  }

  /**
   * Sync all connections for a single user
   */
  private async syncUserConnections(
    userId: string,
    syncFn: UserSyncOptions["syncFn"]
  ): Promise<{ success: boolean; error?: unknown }> {
    try {
      logEvent("CRON:batch-sync", "user-sync-start", { userId });

      // Get all connections for this user
      const connections = await findAccountConnectionsByUserId(userId);

      if (connections.length === 0) {
        logEvent("CRON:batch-sync", "user-no-connections", { userId }, "warn");
        return { success: true };
      }

      logEvent("CRON:batch-sync", "user-connections-found", {
        userId,
        connectionCount: connections.length,
      });

      // Sync each connection
      for (const connection of connections) {
        logEvent("CRON:batch-sync", "connection-sync-start", {
          userId,
          itemId: connection.itemId,
        });

        await syncFn(userId, connection);

        logEvent("CRON:batch-sync", "connection-sync-complete", {
          userId,
          itemId: connection.itemId,
        });
      }

      logEvent("CRON:batch-sync", "user-sync-complete", { userId });
      return { success: true };
    } catch (error: any) {
      logEvent(
        "CRON:batch-sync",
        "user-sync-error",
        { userId, error: error.message },
        "error"
      );
      return { success: false, error };
    }
  }

  /**
   * Sync all users with Plaid connections
   * Handles error isolation, stats tracking, and logging
   */
  async syncAllUsers(options: UserSyncOptions): Promise<void> {
    const { syncFn, environment, failOnError = true } = options;

    if (environment) {
      logEvent("CRON:batch-sync", "filter-environment", { environment });
    }

    // Get all user IDs (optionally filtered by environment)
    const userIds = await this.getAllUserIds(environment);

    if (userIds.length === 0) {
      logEvent(
        "CRON:batch-sync",
        "no-users-found",
        {
          message: environment
            ? `No users found with ${environment} connections`
            : "No users found with Plaid connections",
        },
        "warn"
      );
      return;
    }

    logEvent("CRON:batch-sync", "users-found", {
      userCount: userIds.length,
    });

    // Use functional batch logger to process all users
    const result = await logBatchOperation(
      "CRON:batch-sync",
      userIds,
      async (userId) => {
        return await this.syncUserConnections(userId, syncFn);
      }
    );

    // Exit with error code if any users failed
    if (result.failedItems > 0 && failOnError) {
      process.exit(1);
    }
  }
}
