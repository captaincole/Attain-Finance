/**
 * Admin Routes
 * Protected endpoints for development/testing operations
 * NOT exposed via MCP - only accessible via direct HTTP calls
 */

import { Router, Request, Response } from "express";
import {
  deleteAllUserData,
  getUserDataSummary,
} from "../storage/repositories/user-data-cleanup.js";
import { logRouteEvent, serializeError } from "../utils/logger.js";

const router = Router();

/**
 * GET /admin/user/:userId/data-summary
 * Check what data exists for a user before deleting
 */
router.get("/user/:userId/data-summary", async (req: Request, res: Response) => {
  const { userId } = req.params;

  // Safety check: Only allow in non-production environments
  if (process.env.PLAID_ENV === "production") {
    return res.status(403).json({
      error: "Admin endpoints are disabled in production",
    });
  }

  try {
    const summary = await getUserDataSummary(userId);

    res.json({
      userId,
      summary,
      message:
        summary.hasConnections || summary.hasAccounts || summary.hasTransactions
          ? "User has data"
          : "User has no data",
    });
  } catch (error: any) {
    logRouteEvent("admin-data-summary", "error", { userId, error: serializeError(error) }, "error");
    res.status(500).json({
      error: "Failed to fetch user data summary",
      details: error.message,
    });
  }
});

/**
 * DELETE /admin/user/:userId/data
 * Delete ALL user data (accounts, transactions, budgets, etc.)
 * Requires confirmation query parameter
 */
router.delete("/user/:userId/data", async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { confirm } = req.query;

  logRouteEvent("admin-data-delete", "request", { userId });

  // Safety check 1: Only allow in sandbox/development
  if (process.env.PLAID_ENV === "production") {
    logRouteEvent("admin-data-delete", "blocked-production", { userId }, "warn");
    return res.status(403).json({
      error: "User data deletion is disabled in production",
      hint: "This endpoint only works when PLAID_ENV=sandbox or PLAID_ENV=development",
    });
  }

  // Safety check 2: Require explicit confirmation
  if (confirm !== "DELETE_ALL_DATA") {
    return res.status(400).json({
      error: "Confirmation required",
      hint: 'Add query parameter: ?confirm=DELETE_ALL_DATA',
      example: `DELETE /admin/user/${userId}/data?confirm=DELETE_ALL_DATA`,
    });
  }

  try {
    // First get a summary to show what will be deleted
    const beforeSummary = await getUserDataSummary(userId);

    // Perform deletion
    const deletionSummary = await deleteAllUserData(userId);

    logRouteEvent("admin-data-delete", "completed", {
      userId,
      beforeSummary,
      deletedSummary: deletionSummary,
    });

    res.json({
      success: true,
      message: "All user data has been deleted",
      before: beforeSummary,
      deleted: deletionSummary,
    });
  } catch (error: any) {
    logRouteEvent("admin-data-delete", "error", { userId, error: serializeError(error) }, "error");
    res.status(500).json({
      error: "Failed to delete user data",
      details: error.message,
    });
  }
});

/**
 * GET /admin/health
 * Simple health check for admin endpoints
 */
router.get("/health", (_req: Request, res: Response) => {
  const isProduction = process.env.PLAID_ENV === "production";

  res.json({
    status: "ok",
    environment: process.env.PLAID_ENV || "unknown",
    adminEndpointsEnabled: !isProduction,
    message: isProduction
      ? "Admin endpoints are disabled in production"
      : "Admin endpoints are available",
  });
});

export default router;
