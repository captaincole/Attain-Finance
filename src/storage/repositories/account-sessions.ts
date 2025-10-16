/**
 * Account Sessions Repository
 * Pure database operations for plaid_sessions table
 * Manages temporary sessions for account connection flow
 */

import { getSupabase } from "../supabase.js";
import { Tables } from "../database.types.js";

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
  console.log("[REPO/ACCOUNT-SESSIONS] Creating session:", sessionId);

  const { data, error } = await getSupabase()
    .from("plaid_sessions")
    .insert({
      session_id: sessionId,
      user_id: userId,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("[REPO/ACCOUNT-SESSIONS] Insert error:", error);
    throw new Error(`Failed to create session: ${error.message}`);
  }

  console.log("[REPO/ACCOUNT-SESSIONS] Session created successfully");

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
  console.log("[REPO/ACCOUNT-SESSIONS] Finding session:", sessionId);

  const { data, error } = await getSupabase()
    .from("plaid_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      console.log("[REPO/ACCOUNT-SESSIONS] Session not found or expired");
      return null;
    }
    console.error("[REPO/ACCOUNT-SESSIONS] Query error:", error);
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
  console.log("[REPO/ACCOUNT-SESSIONS] Marking session completed:", sessionId);

  const { error } = await getSupabase()
    .from("plaid_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);

  if (error) {
    console.error("[REPO/ACCOUNT-SESSIONS] Update error:", error);
    throw new Error(`Failed to complete session: ${error.message}`);
  }

  console.log("[REPO/ACCOUNT-SESSIONS] Session marked completed");
}

/**
 * Mark a session as failed
 */
export async function markAccountSessionFailed(
  sessionId: string,
  errorMessage: string
): Promise<void> {
  console.log("[REPO/ACCOUNT-SESSIONS] Marking session failed:", sessionId);

  const { error } = await getSupabase()
    .from("plaid_sessions")
    .update({
      status: "failed",
      error: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);

  if (error) {
    console.error("[REPO/ACCOUNT-SESSIONS] Update error:", error);
    throw new Error(`Failed to fail session: ${error.message}`);
  }

  console.log("[REPO/ACCOUNT-SESSIONS] Session marked failed");
}

/**
 * Cancel all pending sessions for a user
 * Used when creating a new session to invalidate old ones
 */
export async function cancelPendingSessionsForUser(userId: string): Promise<number> {
  console.log("[REPO/ACCOUNT-SESSIONS] Cancelling pending sessions for user:", userId);

  const { data, error } = await getSupabase()
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
    console.error("[REPO/ACCOUNT-SESSIONS] Update error:", error);
    throw new Error(`Failed to cancel pending sessions: ${error.message}`);
  }

  const count = data?.length || 0;
  if (count > 0) {
    console.log("[REPO/ACCOUNT-SESSIONS] Cancelled", count, "pending session(s)");
  }

  return count;
}

/**
 * Delete expired sessions (cleanup utility)
 */
export async function deleteExpiredAccountSessions(): Promise<number> {
  console.log("[REPO/ACCOUNT-SESSIONS] Cleaning up expired sessions");

  const { data, error } = await getSupabase()
    .from("plaid_sessions")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .select();

  if (error) {
    console.error("[REPO/ACCOUNT-SESSIONS] Delete error:", error);
    throw new Error(`Failed to cleanup sessions: ${error.message}`);
  }

  const count = data?.length || 0;
  if (count > 0) {
    console.log("[REPO/ACCOUNT-SESSIONS] Cleaned up", count, "expired sessions");
  }

  return count;
}
