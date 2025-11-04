/**
 * Integration tests for transactions table Row Level Security policies.
 * Verifies per-user isolation for select/update/delete operations.
 */

import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert";
import {
  createTestSupabaseClient,
  createTestSupabaseAdminClient,
  cleanupTestUser,
  createTestConnection,
} from "../helpers/test-db.js";

describe("Transactions RLS", () => {
  const userA = "test-user-rls-a";
  const userB = "test-user-rls-b";
  const supabaseUserA = createTestSupabaseClient(userA);
  const supabaseUserB = createTestSupabaseClient(userB);
  const adminSupabase = createTestSupabaseAdminClient();

  let userATransactionId: string;
  let userBTransactionId: string;

  beforeEach(async () => {
    await cleanupTestUser(adminSupabase, userA);
    await cleanupTestUser(adminSupabase, userB);

    await createTestConnection(adminSupabase, {
      itemId: `item_${userA}`,
      userId: userA,
      institutionName: "Test Bank A",
    });

    await createTestConnection(adminSupabase, {
      itemId: `item_${userB}`,
      userId: userB,
      institutionName: "Test Bank B",
    });

    const timestamp = Date.now();
    userATransactionId = `tx_${timestamp}_a`;
    userBTransactionId = `tx_${timestamp}_b`;

    const { error } = await adminSupabase.from("transactions").insert([
      {
        transaction_id: userATransactionId,
        user_id: userA,
        item_id: `item_${userA}`,
        account_id: `acc_${userA}`,
        date: "2024-01-01",
        name: "User A Purchase",
        amount: 10.5,
        pending: false,
      },
      {
        transaction_id: userBTransactionId,
        user_id: userB,
        item_id: `item_${userB}`,
        account_id: `acc_${userB}`,
        date: "2024-01-02",
        name: "User B Purchase",
        amount: 25.25,
        pending: false,
      },
    ]);

    if (error) {
      throw new Error(`Failed to seed transactions: ${error.message}`);
    }
  });

  after(async () => {
    await cleanupTestUser(adminSupabase, userA);
    await cleanupTestUser(adminSupabase, userB);
  });

  it("allows each user to read only their transactions", async () => {
    const { data: userAData, error: userAError } = await supabaseUserA
      .from("transactions")
      .select("transaction_id,user_id")
      .order("transaction_id");

    assert.ifError(userAError);
    assert(userAData);
    assert.equal(userAData.length, 1);
    assert.equal(userAData[0].transaction_id, userATransactionId);
    assert.equal(userAData[0].user_id, userA);

    const { data: userBData, error: userBError } = await supabaseUserB
      .from("transactions")
      .select("transaction_id,user_id")
      .order("transaction_id");

    assert.ifError(userBError);
    assert(userBData);
    assert.equal(userBData.length, 1);
    assert.equal(userBData[0].transaction_id, userBTransactionId);
    assert.equal(userBData[0].user_id, userB);
  });

  it("prevents users from updating other users' transactions", async () => {
    const { data: updateData, error } = await supabaseUserB
      .from("transactions")
      .update({ name: "Updated by user B" })
      .eq("transaction_id", userATransactionId)
      .select("transaction_id");

    assert.ifError(error);
    assert.equal(updateData?.length ?? 0, 0, "Should not update other user's transaction");

    const { data, error: fetchError } = await supabaseUserA
      .from("transactions")
      .select("name")
      .eq("transaction_id", userATransactionId)
      .maybeSingle();

    assert.ifError(fetchError);
    assert(data);
    assert.equal(data.name, "User A Purchase");
  });

  it("prevents users from deleting other users' transactions", async () => {
    const { data: deleteData, error } = await supabaseUserB
      .from("transactions")
      .delete()
      .eq("transaction_id", userATransactionId)
      .select("transaction_id");

    assert.ifError(error);
    assert.equal(deleteData?.length ?? 0, 0, "Should not delete other user's transaction");

    const { count, error: countError } = await adminSupabase
      .from("transactions")
      .select("transaction_id", { head: true, count: "exact" })
      .eq("transaction_id", userATransactionId);

    assert.ifError(countError);
    assert.equal(count, 1);
  });
});
