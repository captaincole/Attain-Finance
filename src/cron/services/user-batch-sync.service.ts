/**
 * User Batch Sync Service
 * Reusable service for syncing operations across all users
 * Handles user fetching, error isolation, and progress tracking
 */

import { getSupabase } from "../../storage/supabase.js";
import {
  findAccountConnectionsByUserId,
  AccountConnection,
} from "../../storage/repositories/account-connections.js";
import { CronLogger } from "../utils/cron-logger.js";

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
   * Logger instance (optional, creates default if not provided)
   */
  logger?: CronLogger;
}

export class UserBatchSyncService {
  /**
   * Get all unique user IDs from plaid_connections table
   * Optionally filter by Plaid environment
   */
  private async getAllUserIds(
    environment?: "sandbox" | "development" | "production"
  ): Promise<string[]> {
    let query = getSupabase().from("plaid_connections").select("user_id");

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
    return uniqueUserIds;
  }

  /**
   * Sync all connections for a single user
   */
  private async syncUserConnections(
    userId: string,
    syncFn: UserSyncOptions["syncFn"],
    logger: CronLogger
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info(`━━━ Syncing user: ${userId} ━━━`);

      // Get all connections for this user
      const connections = await findAccountConnectionsByUserId(userId);

      if (connections.length === 0) {
        logger.warn(`User ${userId} has no connections, skipping`);
        return { success: true };
      }

      logger.info(
        `User ${userId} has ${connections.length} connection(s)`
      );

      // Sync each connection
      for (const connection of connections) {
        try {
          logger.info(`Syncing connection ${connection.itemId}`);
          await syncFn(userId, connection);
          logger.success(
            `Connection ${connection.itemId} synced successfully`
          );
        } catch (error: any) {
          logger.error(
            `Failed to sync connection ${connection.itemId}`,
            error
          );
          throw error; // Propagate to mark user as failed
        }
      }

      logger.success(`User ${userId} sync complete`);
      return { success: true };
    } catch (error: any) {
      logger.error(`User ${userId} sync failed`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Sync all users with Plaid connections
   * Handles error isolation, stats tracking, and logging
   */
  async syncAllUsers(options: UserSyncOptions): Promise<void> {
    const {
      syncFn,
      parallel = false,
      environment,
      logger = new CronLogger("batch-sync"),
    } = options;

    logger.logStart();

    if (environment) {
      logger.info(`Filtering connections by environment: ${environment}`);
    }

    try {
      // Get all user IDs (optionally filtered by environment)
      const userIds = await this.getAllUserIds(environment);
      logger.info(`Found ${userIds.length} unique users`);

      if (userIds.length === 0) {
        logger.warn(
          environment
            ? `No users found with ${environment} connections`
            : "No users found with Plaid connections"
        );
        return;
      }

      logger.updateStats({ totalItems: userIds.length });

      // Sync each user (sequential or parallel)
      if (parallel) {
        // Parallel execution (faster but less safe)
        const results = await Promise.allSettled(
          userIds.map((userId) =>
            this.syncUserConnections(userId, syncFn, logger)
          )
        );

        results.forEach((result) => {
          if (result.status === "fulfilled" && result.value.success) {
            logger.incrementSuccess();
          } else {
            logger.incrementFailure();
          }
        });
      } else {
        // Sequential execution (safer, default)
        for (const userId of userIds) {
          const result = await this.syncUserConnections(userId, syncFn, logger);

          if (result.success) {
            logger.incrementSuccess();
          } else {
            logger.incrementFailure();
          }
        }
      }
    } catch (error: any) {
      logger.error("Fatal error during batch sync", error);
      throw error;
    } finally {
      logger.logSummary();

      // Exit with error code if any users failed
      if (logger.hasFailures()) {
        process.exit(1);
      }
    }
  }
}
