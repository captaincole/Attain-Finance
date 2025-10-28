/**
 * Account Connections Repository
 * Pure database operations for account_connections table (formerly plaid_connections)
 * Handles encryption/decryption of access tokens
 */

import crypto from "crypto";
import { getSupabase } from "../supabase.js";
import { Tables } from "../database.types.js";
import { logEvent } from "../../utils/logger.js";

// Encryption configuration
const ALGORITHM = "aes-256-gcm";
let keyBuffer: Buffer | null = null;

/**
 * Get or create encryption key buffer (lazy initialization)
 */
function getKeyBuffer(): Buffer {
  if (keyBuffer) {
    return keyBuffer;
  }

  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

  if (!ENCRYPTION_KEY) {
    throw new Error(
      "Missing ENCRYPTION_KEY. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }

  // Ensure the key is exactly 32 bytes (64 hex characters)
  keyBuffer = Buffer.from(ENCRYPTION_KEY, "hex");
  if (keyBuffer.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)"
    );
  }

  return keyBuffer;
}

/**
 * Encrypt an access token using AES-256-GCM
 */
function encryptAccessToken(accessToken: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKeyBuffer(), iv);

  let encrypted = cipher.update(accessToken, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt an access token
 */
function decryptAccessToken(encryptedToken: string): string {
  const parts = encryptedToken.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const [ivHex, authTagHex, encryptedData] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, getKeyBuffer(), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Database row type
 */
export type AccountConnectionRow = Tables<"plaid_connections">;

/**
 * Decrypted connection data
 */
export interface AccountConnection {
  userId: string;
  accessToken: string; // Decrypted
  itemId: string;
  connectedAt: Date;
  environment: "sandbox" | "development" | "production";
  institutionName?: string | null;
  status?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
}

/**
 * Insert or update an account connection
 */
export async function upsertAccountConnection(
  userId: string,
  accessToken: string,
  itemId: string,
  environment: "sandbox" | "development" | "production",
  institutionName?: string
): Promise<void> {
  logEvent("REPO/ACCOUNT-CONNECTIONS", "upserting-connection", { userId, itemId, environment, institutionName });

  const encryptedToken = encryptAccessToken(accessToken);

  const { error } = await getSupabase()
    .from("plaid_connections")
    .upsert(
      {
        user_id: userId,
        access_token_encrypted: encryptedToken,
        item_id: itemId,
        connected_at: new Date().toISOString(),
        plaid_env: environment,
        institution_name: institutionName || null,
        status: 'active',
      },
      {
        onConflict: "item_id",
      }
    );

  if (error) {
    logEvent("REPO/ACCOUNT-CONNECTIONS", "upsert-error", { error: error.message }, "error");
    throw new Error(`Failed to save connection: ${error.message}`);
  }

  logEvent("REPO/ACCOUNT-CONNECTIONS", "connection-saved", { userId, itemId });
}

/**
 * Get all connections for a user (with decrypted tokens)
 */
export async function findAccountConnectionsByUserId(
  userId: string
): Promise<AccountConnection[]> {
  logEvent("REPO/ACCOUNT-CONNECTIONS", "fetching-connections", { userId });

  const { data, error } = await getSupabase()
    .from("plaid_connections")
    .select("*")
    .eq("user_id", userId)
    .order("connected_at", { ascending: false });

  if (error) {
    logEvent("REPO/ACCOUNT-CONNECTIONS", "query-error", { error: error.message }, "error");
    throw new Error(`Failed to fetch connections: ${error.message}`);
  }

  if (!data || data.length === 0) {
    logEvent("REPO/ACCOUNT-CONNECTIONS", "no-connections-found", { userId });
    return [];
  }

  logEvent("REPO/ACCOUNT-CONNECTIONS", "found-connections", { userId, count: data.length });

  // Decrypt all connections
  return data.map((row) => ({
    userId: row.user_id,
    accessToken: decryptAccessToken(row.access_token_encrypted),
    itemId: row.item_id,
    connectedAt: new Date(row.connected_at || new Date()),
    environment: (row.plaid_env || "sandbox") as "sandbox" | "development" | "production",
    institutionName: row.institution_name || null,
    status: row.status || 'active',
    errorCode: row.error_code || null,
    errorMessage: row.error_message || null,
  }));
}

/**
 * Delete a connection by item ID
 */
export async function deleteAccountConnectionByItemId(itemId: string): Promise<void> {
  logEvent("REPO/ACCOUNT-CONNECTIONS", "deleting-connection", { itemId });

  const { error } = await getSupabase()
    .from("plaid_connections")
    .delete()
    .eq("item_id", itemId);

  if (error) {
    logEvent("REPO/ACCOUNT-CONNECTIONS", "delete-error", { error: error.message }, "error");
    throw new Error(`Failed to delete connection: ${error.message}`);
  }

  logEvent("REPO/ACCOUNT-CONNECTIONS", "connection-deleted", { itemId });
}

/**
 * Delete all connections for a user
 */
export async function deleteAllAccountConnectionsByUserId(userId: string): Promise<void> {
  logEvent("REPO/ACCOUNT-CONNECTIONS", "deleting-all-connections", { userId });

  const { error } = await getSupabase()
    .from("plaid_connections")
    .delete()
    .eq("user_id", userId);

  if (error) {
    logEvent("REPO/ACCOUNT-CONNECTIONS", "delete-error", { error: error.message }, "error");
    throw new Error(`Failed to delete connections: ${error.message}`);
  }

  logEvent("REPO/ACCOUNT-CONNECTIONS", "all-connections-deleted", { userId });
}
