/**
 * Account Sessions Repository
 * Pure database operations for plaid_sessions table
 * Manages temporary sessions for account connection flow
 */

import { getSupabaseServiceRole } from "../supabase.js";
import { Tables } from "../database.types.js";
import { logEvent } from "../../utils/logger.js";

/**
 * Database row type
 */
export type AccountSessionRow = Tables<"plaid_sessions">;

/**
 * Session data
 */
export interface AccountSession {
  sessionId: string;
  userId: string;
  status: "pending" | "completed" | "failed";
  createdAt: Date;
  expiresAt: Date;
  completedAt?: Date;
  error?: string;
}

/**
 * Create a new session
 */
export async function createAccountSession(
  sessionId: string,
  userId: string
): Promise<AccountSession> {
  logEvent("REPO/ACCOUNT-SESSIONS", "creating-session", { sessionId, userId });

  const { data, error } = await getSupabaseServiceRole()
    .from("plaid_sessions")
    .insert({
      session_id: sessionId,
      user_id: userId,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    logEvent("REPO/ACCOUNT-SESSIONS", "insert-error", { error: error.message }, "error");
    throw new Error(`Failed to create session: ${error.message}`);
  }

  logEvent("REPO/ACCOUNT-SESSIONS", "session-created", { sessionId });

  return {
    sessionId: data.session_id,
    userId: data.user_id,
    status: data.status as "pending" | "completed" | "failed",
    createdAt: new Date(data.created_at || Date.now()),
    expiresAt: new Date(data.expires_at || Date.now() + 30 * 60 * 1000),
    completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    error: data.error || undefined,
  };
}

/**
 * Find a session by ID (only if not expired)
 */
export async function findAccountSessionById(
  sessionId: string
): Promise<AccountSession | null> {
  logEvent("REPO/ACCOUNT-SESSIONS", "finding-session", { sessionId });

  const { data, error } = await getSupabaseServiceRole()
    .from("plaid_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      logEvent("REPO/ACCOUNT-SESSIONS", "session-not-found", { sessionId });
      return null;
    }
    logEvent("REPO/ACCOUNT-SESSIONS", "query-error", { error: error.message }, "error");
    throw new Error(`Failed to fetch session: ${error.message}`);
  }

  return {
    sessionId: data.session_id,
    userId: data.user_id,
    status: data.status as "pending" | "completed" | "failed",
    createdAt: new Date(data.created_at || Date.now()),
    expiresAt: new Date(data.expires_at || Date.now() + 30 * 60 * 1000),
    completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    error: data.error || undefined,
  };
}

/**
 * Mark a session as completed
 */
export async function markAccountSessionCompleted(sessionId: string): Promise<void> {
  logEvent("REPO/ACCOUNT-SESSIONS", "marking-session-completed", { sessionId });

  const { error } = await getSupabaseServiceRole()
    .from("plaid_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);

  if (error) {
    logEvent("REPO/ACCOUNT-SESSIONS", "update-error", { error: error.message }, "error");
    throw new Error(`Failed to complete session: ${error.message}`);
  }

  logEvent("REPO/ACCOUNT-SESSIONS", "session-marked-completed", { sessionId });
}

/**
 * Mark a session as failed
 */
export async function markAccountSessionFailed(
  sessionId: string,
  errorMessage: string
): Promise<void> {
  logEvent("REPO/ACCOUNT-SESSIONS", "marking-session-failed", { sessionId, errorMessage });

  const { error } = await getSupabaseServiceRole()
    .from("plaid_sessions")
    .update({
      status: "failed",
      error: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);

  if (error) {
    logEvent("REPO/ACCOUNT-SESSIONS", "update-error", { error: error.message }, "error");
    throw new Error(`Failed to fail session: ${error.message}`);
  }

  logEvent("REPO/ACCOUNT-SESSIONS", "session-marked-failed", { sessionId });
}

/**
 * Cancel all pending sessions for a user
 * Used when creating a new session to invalidate old ones
 */
export async function cancelPendingSessionsForUser(userId: string): Promise<number> {
  logEvent("REPO/ACCOUNT-SESSIONS", "cancelling-pending-sessions", { userId });

  const { data, error } = await getSupabaseServiceRole()
    .from("plaid_sessions")
    .update({
      status: "failed",
      error: "Superseded by new connection attempt",
      completed_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("status", "pending")
    .select();

  if (error) {
    logEvent("REPO/ACCOUNT-SESSIONS", "update-error", { error: error.message }, "error");
    throw new Error(`Failed to cancel pending sessions: ${error.message}`);
  }

  const count = data?.length || 0;
  if (count > 0) {
    logEvent("REPO/ACCOUNT-SESSIONS", "cancelled-sessions", { userId, count });
  }

  return count;
}

/**
 * Delete expired sessions (cleanup utility)
 */
export async function deleteExpiredAccountSessions(): Promise<number> {
  logEvent("REPO/ACCOUNT-SESSIONS", "cleaning-up-expired-sessions");

  const { data, error } = await getSupabaseServiceRole()
    .from("plaid_sessions")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .select();

  if (error) {
    logEvent("REPO/ACCOUNT-SESSIONS", "delete-error", { error: error.message }, "error");
    throw new Error(`Failed to cleanup sessions: ${error.message}`);
  }

  const count = data?.length || 0;
  if (count > 0) {
    logEvent("REPO/ACCOUNT-SESSIONS", "cleaned-up-sessions", { count });
  }

  return count;
}
