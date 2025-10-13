import { getSupabase } from "../supabase.js";
import { Tables } from "../database.types.js";

/**
 * Database type for plaid_sessions table
 */
export type PlaidSession = Tables<"plaid_sessions">;

/**
 * Create a new Plaid Link session
 * @param sessionId - Unique session identifier (UUID)
 * @param userId - Clerk user ID
 * @returns Created session
 */
export async function createSession(
  sessionId: string,
  userId: string
): Promise<PlaidSession> {
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
    console.error("Error creating Plaid session:", error);
    throw new Error(`Failed to create session: ${error.message}`);
  }

  console.log(`✓ Created Plaid session ${sessionId} for user ${userId}`);

  return data;
}

/**
 * Get a Plaid Link session by ID
 * @param sessionId - Session identifier
 * @returns Session data or null if not found/expired
 */
export async function getSession(
  sessionId: string
): Promise<PlaidSession | null> {
  const { data, error } = await getSupabase()
    .from("plaid_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .gt("expires_at", new Date().toISOString()) // Only return non-expired sessions
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // No rows returned - session not found or expired
      return null;
    }
    console.error("Error fetching Plaid session:", error);
    throw new Error(`Failed to fetch session: ${error.message}`);
  }

  return data;
}

/**
 * Mark a session as completed
 * @param sessionId - Session identifier
 */
export async function completeSession(sessionId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("plaid_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);

  if (error) {
    console.error("Error completing Plaid session:", error);
    throw new Error(`Failed to complete session: ${error.message}`);
  }

  console.log(`✓ Marked session ${sessionId} as completed`);
}

/**
 * Mark a session as failed
 * @param sessionId - Session identifier
 * @param errorMessage - Error description
 */
export async function failSession(
  sessionId: string,
  errorMessage: string
): Promise<void> {
  const { error } = await getSupabase()
    .from("plaid_sessions")
    .update({
      status: "failed",
      error: errorMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("session_id", sessionId);

  if (error) {
    console.error("Error failing Plaid session:", error);
    throw new Error(`Failed to fail session: ${error.message}`);
  }

  console.log(`✓ Marked session ${sessionId} as failed`);
}

/**
 * Delete expired sessions (cleanup utility)
 * Call this periodically to clean up old sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const { data, error } = await getSupabase()
    .from("plaid_sessions")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .select();

  if (error) {
    console.error("Error cleaning up expired sessions:", error);
    throw new Error(`Failed to cleanup sessions: ${error.message}`);
  }

  const count = data?.length || 0;
  if (count > 0) {
    console.log(`✓ Cleaned up ${count} expired sessions`);
  }

  return count;
}
