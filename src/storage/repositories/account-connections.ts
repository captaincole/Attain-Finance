/**
 * Account Connections Repository
 * Pure database operations for account_connections table (formerly plaid_connections)
 * Handles encryption/decryption of access tokens
 */

import crypto from "crypto";
import { getSupabase } from "../supabase.js";
import { Tables } from "../database.types.js";

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
}

/**
 * Insert or update an account connection
 */
export async function upsertAccountConnection(
  userId: string,
  accessToken: string,
  itemId: string,
  environment: "sandbox" | "development" | "production"
): Promise<void> {
  console.log("[REPO/ACCOUNT-CONNECTIONS] Upserting connection for user:", userId);

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
      },
      {
        onConflict: "item_id",
      }
    );

  if (error) {
    console.error("[REPO/ACCOUNT-CONNECTIONS] Upsert error:", error);
    throw new Error(`Failed to save connection: ${error.message}`);
  }

  console.log("[REPO/ACCOUNT-CONNECTIONS] Connection saved successfully");
}

/**
 * Get all connections for a user (with decrypted tokens)
 */
export async function findAccountConnectionsByUserId(
  userId: string
): Promise<AccountConnection[]> {
  console.log("[REPO/ACCOUNT-CONNECTIONS] Fetching connections for user:", userId);

  const { data, error } = await getSupabase()
    .from("plaid_connections")
    .select("*")
    .eq("user_id", userId)
    .order("connected_at", { ascending: false });

  if (error) {
    console.error("[REPO/ACCOUNT-CONNECTIONS] Query error:", error);
    throw new Error(`Failed to fetch connections: ${error.message}`);
  }

  if (!data || data.length === 0) {
    console.log("[REPO/ACCOUNT-CONNECTIONS] No connections found");
    return [];
  }

  console.log("[REPO/ACCOUNT-CONNECTIONS] Found", data.length, "connections");

  // Decrypt all connections
  return data.map((row) => ({
    userId: row.user_id,
    accessToken: decryptAccessToken(row.access_token_encrypted),
    itemId: row.item_id,
    connectedAt: new Date(row.connected_at || new Date()),
    environment: (row.plaid_env || "sandbox") as "sandbox" | "development" | "production",
  }));
}

/**
 * Delete a connection by item ID
 */
export async function deleteAccountConnectionByItemId(itemId: string): Promise<void> {
  console.log("[REPO/ACCOUNT-CONNECTIONS] Deleting connection:", itemId);

  const { error } = await getSupabase()
    .from("plaid_connections")
    .delete()
    .eq("item_id", itemId);

  if (error) {
    console.error("[REPO/ACCOUNT-CONNECTIONS] Delete error:", error);
    throw new Error(`Failed to delete connection: ${error.message}`);
  }

  console.log("[REPO/ACCOUNT-CONNECTIONS] Connection deleted successfully");
}

/**
 * Delete all connections for a user
 */
export async function deleteAllAccountConnectionsByUserId(userId: string): Promise<void> {
  console.log("[REPO/ACCOUNT-CONNECTIONS] Deleting all connections for user:", userId);

  const { error } = await getSupabase()
    .from("plaid_connections")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("[REPO/ACCOUNT-CONNECTIONS] Delete error:", error);
    throw new Error(`Failed to delete connections: ${error.message}`);
  }

  console.log("[REPO/ACCOUNT-CONNECTIONS] All connections deleted successfully");
}
