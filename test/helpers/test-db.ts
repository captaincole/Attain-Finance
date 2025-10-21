/**
 * Test database helper for local Supabase integration tests
 * Provides centralized setup/teardown and common test data
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import dotenv from "dotenv";

// Load test environment variables
dotenv.config({ path: ".env.test" });

// Verify required env vars
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env.test");
}

if (!process.env.ENCRYPTION_KEY) {
  throw new Error("Missing ENCRYPTION_KEY in .env.test");
}

export interface TestConnection {
  itemId: string;
  userId: string;
  institutionName: string;
}

export interface TestAccount {
  accountId: string;
  userId: string;
  itemId: string;
  name: string;
  type: string;
  subtype: string;
}

export interface TestTransaction {
  transaction_id: string;
  user_id: string;
  item_id: string;
  account_id: string;
  date: string;
  name: string;
  amount: number;
  pending: boolean;
}

/**
 * Create a Supabase client for testing
 */
export function createTestSupabaseClient(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
}

/**
 * Clean up all test data for a specific user
 */
export async function cleanupTestUser(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  // Delete in reverse order of dependencies (foreign keys)
  await supabase.from("transactions").delete().eq("user_id", userId);
  await supabase.from("account_sync_state").delete().eq("user_id", userId);
  await supabase.from("accounts").delete().eq("user_id", userId);
  await supabase.from("budgets").delete().eq("user_id", userId);
  await supabase.from("categorization_prompts").delete().eq("user_id", userId);
  await supabase.from("plaid_connections").delete().eq("user_id", userId);
  await supabase.from("plaid_sessions").delete().eq("user_id", userId);
}

/**
 * Encrypt a test access token using the same encryption as production
 * This ensures tests can properly decrypt tokens
 */
function encryptTestAccessToken(accessToken: string): string {
  const ALGORITHM = "aes-256-gcm";
  const keyBuffer = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(accessToken, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Create a test Plaid connection
 */
export async function createTestConnection(
  supabase: SupabaseClient,
  connection: TestConnection
): Promise<void> {
  const { error } = await supabase.from("plaid_connections").insert({
    item_id: connection.itemId,
    user_id: connection.userId,
    access_token_encrypted: encryptTestAccessToken(`test-access-token-${connection.itemId}`),
    institution_name: connection.institutionName,
    status: "active",
  });

  if (error) {
    throw new Error(`Failed to create test connection: ${error.message}`);
  }
}

/**
 * Create test transactions
 */
export async function createTestTransactions(
  supabase: SupabaseClient,
  transactions: TestTransaction[]
): Promise<void> {
  const { error } = await supabase.from("transactions").insert(transactions);

  if (error) {
    throw new Error(`Failed to create test transactions: ${error.message}`);
  }
}

/**
 * Common test data factory - creates a connection with sample transactions
 */
export async function setupCommonTestData(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  connection: TestConnection;
  transactions: TestTransaction[];
}> {
  const connection: TestConnection = {
    itemId: `item_${userId}`,
    userId,
    institutionName: "Test Bank",
  };

  await createTestConnection(supabase, connection);

  const transactions: TestTransaction[] = [
    {
      transaction_id: `${userId}_tx_1`,
      user_id: userId,
      item_id: connection.itemId,
      account_id: `${userId}_acc_checking`,
      date: "2024-01-15",
      name: "Starbucks Coffee",
      amount: 5.75,
      pending: false,
    },
    {
      transaction_id: `${userId}_tx_2`,
      user_id: userId,
      item_id: connection.itemId,
      account_id: `${userId}_acc_checking`,
      date: "2024-01-14",
      name: "Whole Foods Market",
      amount: 87.32,
      pending: false,
    },
    {
      transaction_id: `${userId}_tx_3`,
      user_id: userId,
      item_id: connection.itemId,
      account_id: `${userId}_acc_checking`,
      date: "2024-01-13",
      name: "Shell Gas Station",
      amount: 45.00,
      pending: false,
    },
  ];

  await createTestTransactions(supabase, transactions);

  return { connection, transactions };
}
