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
 * Encrypt a Plaid access token using AES-256-GCM
 * @param accessToken - The plaintext access token
 * @returns Encrypted string in format: iv:authTag:encryptedData
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
 * Decrypt a Plaid access token
 * @param encryptedToken - Encrypted string in format: iv:authTag:encryptedData
 * @returns Decrypted plaintext access token
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
 * Database type for plaid_connections table
 */
export type PlaidConnection = Tables<"plaid_connections">;

/**
 * Return type with decrypted access token
 */
export interface PlaidConnectionDecrypted {
  userId: string;
  accessToken: string;
  itemId: string;
  connectedAt: Date;
  plaidEnv: "sandbox" | "development" | "production";
}

/**
 * Save a Plaid connection to the database (upsert)
 * @param userId - Clerk user ID
 * @param accessToken - Plaid access token (will be encrypted)
 * @param itemId - Plaid item ID
 */
export async function saveConnection(
  userId: string,
  accessToken: string,
  itemId: string
): Promise<void> {
  const encryptedToken = encryptAccessToken(accessToken);
  const plaidEnv = (process.env.PLAID_ENV || "sandbox") as "sandbox" | "development" | "production";

  const { error } = await getSupabase()
    .from("plaid_connections")
    .upsert(
      {
        user_id: userId,
        access_token_encrypted: encryptedToken,
        item_id: itemId,
        connected_at: new Date().toISOString(),
        plaid_env: plaidEnv,
      },
      {
        onConflict: "item_id",
      }
    );

  if (error) {
    console.error("Error saving Plaid connection:", error);
    throw new Error(`Failed to save connection: ${error.message}`);
  }

  console.log(`✓ Saved Plaid connection for user ${userId} (${plaidEnv})`);
}

/**
 * Get all Plaid connections for a user
 * @param userId - Clerk user ID
 * @returns Array of decrypted connections (empty array if none found)
 */
export async function getConnections(
  userId: string
): Promise<PlaidConnectionDecrypted[]> {
  const { data, error } = await getSupabase()
    .from("plaid_connections")
    .select("*")
    .eq("user_id", userId)
    .order("connected_at", { ascending: false });

  if (error) {
    console.error("Error fetching Plaid connections:", error);
    throw new Error(`Failed to fetch connections: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Decrypt all connections
  return data.map((connection) => {
    const decryptedToken = decryptAccessToken(connection.access_token_encrypted);

    return {
      userId: connection.user_id,
      accessToken: decryptedToken,
      itemId: connection.item_id,
      connectedAt: new Date(connection.connected_at || new Date()),
      plaidEnv: (connection.plaid_env || "sandbox") as "sandbox" | "development" | "production",
    };
  });
}

/**
 * Get a single Plaid connection (for backward compatibility)
 * @param userId - Clerk user ID
 * @returns First connection or null if not found
 * @deprecated Use getConnections() instead to support multiple institutions
 */
export async function getConnection(
  userId: string
): Promise<PlaidConnectionDecrypted | null> {
  const connections = await getConnections(userId);
  return connections.length > 0 ? connections[0] : null;
}

/**
 * Delete a specific Plaid connection by item ID
 * @param itemId - Plaid item ID
 */
export async function deleteConnectionByItemId(itemId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("plaid_connections")
    .delete()
    .eq("item_id", itemId);

  if (error) {
    console.error("Error deleting Plaid connection:", error);
    throw new Error(`Failed to delete connection: ${error.message}`);
  }

  console.log(`✓ Deleted Plaid connection ${itemId}`);
}

/**
 * Delete all Plaid connections for a user
 * @param userId - Clerk user ID
 */
export async function deleteAllConnections(userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("plaid_connections")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting Plaid connections:", error);
    throw new Error(`Failed to delete connections: ${error.message}`);
  }

  console.log(`✓ Deleted all Plaid connections for user ${userId}`);
}
