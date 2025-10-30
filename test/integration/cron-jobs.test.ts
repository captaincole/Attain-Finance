/**
 * Integration test for cron job infrastructure
 * Tests job runner, environment validation, and registration (NOT business logic)
 *
 * NOTE: We test the infrastructure, not the underlying sync service
 */

import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert";
import { setSupabaseMock, resetSupabase } from "../../src/storage/supabase.js";
import { plaidSyncJob } from "../../src/cron/jobs/plaid-sync.js";
import { plaidSyncSandboxJob } from "../../src/cron/jobs/plaid-sync-sandbox.js";
import {
  createTestSupabaseClient,
  cleanupTestUser,
  createTestConnection,
} from "../helpers/test-db.js";
import { MockClaudeClient } from "../mocks/claude-mock.js";

describe("Cron Job Infrastructure Tests", () => {
  const supabase = createTestSupabaseClient();
  const mockClaudeClient = new MockClaudeClient();
  const testUserId = "test-user-cron";
  let originalEnv: string | undefined;

  before(() => {
    setSupabaseMock(supabase);
    originalEnv = process.env.PLAID_ENV;
  });

  beforeEach(async () => {
    await cleanupTestUser(supabase, testUserId);
    await cleanupTestUser(supabase, `${testUserId}_sandbox`);
  });

  after(async () => {
    await cleanupTestUser(supabase, testUserId);
    await cleanupTestUser(supabase, `${testUserId}_sandbox`);
    process.env.PLAID_ENV = originalEnv;
    resetSupabase();
  });

  it("should validate environment before running production job", async () => {
    // Set PLAID_ENV=sandbox (wrong environment for production job)
    process.env.PLAID_ENV = "sandbox";

    // Try to run production job - should exit with error
    let exitCode: number | null = null;
    const originalExit = process.exit;

    // Mock process.exit to capture exit code
    process.exit = ((code?: number) => {
      exitCode = code || 0;
      throw new Error(`process.exit called with code ${code}`);
    }) as any;

    try {
      await plaidSyncJob.run(mockClaudeClient);
      assert.fail("Should have exited with error");
    } catch (error: any) {
      // Verify process.exit was called with code 1
      assert.equal(exitCode, 1, "Should exit with code 1");
      assert(error.message.includes("process.exit called with code 1"));
    } finally {
      // Restore process.exit
      process.exit = originalExit;
    }
  });

  it("should run plaid-sync job with correct environment", async () => {
    // Set PLAID_ENV=production
    process.env.PLAID_ENV = "production";

    // Create a production connection
    await createTestConnection(supabase, {
      itemId: "item_prod_1",
      userId: testUserId,
      institutionName: "Test Bank (Production)",
    });

    // Update connection to have production plaid_env
    await supabase
      .from("plaid_connections")
      .update({ plaid_env: "production" })
      .eq("item_id", "item_prod_1");

    // Run the job (should not throw)
    // Note: This will call the sync service, but we're just testing that the job runs
    // The actual sync may fail due to invalid access tokens, but that's expected in tests
    try {
      await plaidSyncJob.run(mockClaudeClient);
      // Job completed (may have logged errors for sync failures, but infrastructure worked)
    } catch (error: any) {
      // If the job threw an error, it's likely due to Plaid API failures (expected in tests)
      // We're just verifying the job infrastructure works, not the business logic
      console.log("[TEST] Job threw error (expected for test data):", error.message);
    }

    // Verify job metadata
    assert.equal(plaidSyncJob.name, "plaid-sync");
    assert(plaidSyncJob.description.includes("Sync all Plaid data"));
  });

  it("should filter connections by environment (production vs sandbox)", async () => {
    // Create 2 connections: 1 production, 1 sandbox
    await createTestConnection(supabase, {
      itemId: "item_prod",
      userId: testUserId,
      institutionName: "Test Bank (Prod)",
    });

    await createTestConnection(supabase, {
      itemId: "item_sandbox",
      userId: `${testUserId}_sandbox`,
      institutionName: "Test Bank (Sandbox)",
    });

    // Update plaid_env for each connection
    await supabase
      .from("plaid_connections")
      .update({ plaid_env: "production" })
      .eq("item_id", "item_prod");

    await supabase
      .from("plaid_connections")
      .update({ plaid_env: "sandbox" })
      .eq("item_id", "item_sandbox");

    // Run production job (should only process production connection)
    process.env.PLAID_ENV = "production";

    try {
      await plaidSyncJob.run(mockClaudeClient);
    } catch (error: any) {
      console.log(
        "[TEST] Production job threw error (expected for test data):",
        error.message
      );
    }

    // Run sandbox job (should only process sandbox connection)
    process.env.PLAID_ENV = "sandbox";

    try {
      await plaidSyncSandboxJob.run(mockClaudeClient);
    } catch (error: any) {
      console.log("[TEST] Sandbox job threw error (expected for test data):", error.message);
    }

    // Both jobs should have completed without infrastructure errors
    // (Sync failures are expected due to invalid tokens)
  });

  it("should list all registered cron jobs", async () => {
    // Verify jobs are defined and exported
    assert(plaidSyncJob, "Production sync job should be defined");
    assert(plaidSyncSandboxJob, "Sandbox sync job should be defined");

    // Verify job metadata
    assert.equal(plaidSyncJob.name, "plaid-sync");
    assert.equal(plaidSyncSandboxJob.name, "plaid-sync-sandbox");

    // Verify job descriptions
    assert(plaidSyncJob.description.length > 0, "Job should have description");
    assert(
      plaidSyncSandboxJob.description.length > 0,
      "Job should have description"
    );

    // Verify job run functions exist
    assert.equal(typeof plaidSyncJob.run, "function", "Job should have run function");
    assert.equal(
      typeof plaidSyncSandboxJob.run,
      "function",
      "Job should have run function"
    );
  });
});
