/**
 * Test database helper for local Supabase integration tests
 * Provides centralized setup/teardown and common test data
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import dotenv from "dotenv";
import {
  getSupabaseEnvironment,
  getSupabaseForUser,
  getSupabaseServiceRole,
} from "../../src/storage/supabase.js";

// Load test environment variables
dotenv.config({ path: ".env.test" });

let supabaseEnv: ReturnType<typeof getSupabaseEnvironment>;
try {
  supabaseEnv = getSupabaseEnvironment();
} catch (error: any) {
  throw new Error(`Supabase test configuration error: ${error.message}`);
}

const { url: SUPABASE_URL, publishableKey: SUPABASE_PUBLISHABLE_KEY, secretKey: SUPABASE_SECRET_KEY } =
  supabaseEnv;

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
 * Create a Supabase client for testing (optionally user-scoped)
 * Uses the publishable key and can include the user header when provided.
 * Use this when testing user-facing operations.
 */
export function createTestSupabaseClient(userId?: string): SupabaseClient {
  if (!userId) {
    return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  const jwtSecret =
    process.env.SUPABASE_JWT_SECRET ||
    "super-secret-jwt-token-with-at-least-32-characters-long";

  const token = jwt.sign(
    {
      sub: userId,
      role: "authenticated",
      iss: "test-suite",
      aud: "authenticated",
    },
    jwtSecret,
    { expiresIn: "1h" }
  );

  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Create a Supabase admin client for testing.
 * Uses the service-role key for full access — primarily for setup/teardown.
 */
export function createTestSupabaseAdminClient(): SupabaseClient {
  return getSupabaseServiceRole();
}

/**
 * Clean up all test data for a specific user using the admin client.
 */
export async function cleanupTestUser(
  _supabase: SupabaseClient,
  userId: string
): Promise<void> {
  // Use admin client for cleanup
  const adminClient = createTestSupabaseAdminClient();

  // Delete in reverse order of dependencies (foreign keys)
  await adminClient.from("transactions").delete().eq("user_id", userId);
  await adminClient.from("investment_holdings").delete().eq("user_id", userId);
  await adminClient.from("liabilities_credit").delete().eq("user_id", userId);
  await adminClient.from("liabilities_mortgage").delete().eq("user_id", userId);
  await adminClient.from("liabilities_student").delete().eq("user_id", userId);

  const { data: userAccountIds, error: accountFetchError } = await adminClient
    .from("accounts")
    .select("account_id")
    .eq("user_id", userId);

  if (accountFetchError) {
    throw new Error(`Failed to fetch accounts for cleanup: ${accountFetchError.message}`);
  }

  const accountIds = (userAccountIds ?? []).map((row) => row.account_id);

  if (accountIds.length > 0) {
    await adminClient.from("account_sync_state").delete().in("account_id", accountIds);
  }

  await adminClient.from("accounts").delete().eq("user_id", userId);
  await adminClient.from("budgets").delete().eq("user_id", userId);
  await adminClient.from("categorization_prompts").delete().eq("user_id", userId);
  await adminClient.from("net_worth_snapshots").delete().eq("user_id", userId);
  await adminClient.from("plaid_connections").delete().eq("user_id", userId);
  await adminClient.from("plaid_sessions").delete().eq("user_id", userId);
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
 * Uses upsert to avoid duplicate key errors from previous test runs
 * Relies on the admin client so no permissions block the insert.
 */
export async function createTestConnection(
  _supabase: SupabaseClient,
  connection: TestConnection
): Promise<void> {
  // Use admin client for test data creation
  const adminClient = createTestSupabaseAdminClient();

  const { error } = await adminClient.from("plaid_connections").upsert({
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
 * Create test transactions using the admin client for unrestricted inserts.
 */
export async function createTestTransactions(
  _supabase: SupabaseClient,
  transactions: TestTransaction[]
): Promise<void> {
  // Use admin client for test data creation
  const adminClient = createTestSupabaseAdminClient();

  const { error } = await adminClient.from("transactions").insert(transactions);

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
