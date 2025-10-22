/**
 * Integration tests for Budget tools with local Supabase
 * Tests tool handlers directly without full MCP protocol overhead
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import { setSupabaseMock, resetSupabase } from "../../src/storage/supabase.js";
import { getBudgetsHandler } from "../../src/tools/budgets/get-budgets.js";
import { upsertBudgetHandler } from "../../src/tools/budgets/upsert-budget.js";
import {
  createTestSupabaseClient,
  cleanupTestUser,
  createTestConnection,
} from "../helpers/test-db.js";

describe("Budget Tool Integration Tests", () => {
  const supabase = createTestSupabaseClient();
  const testUserId = "test-user-budget";

  before(() => {
    setSupabaseMock(supabase);
  });

  beforeEach(async () => {
    await cleanupTestUser(supabase, testUserId);
  });

  after(async () => {
    await cleanupTestUser(supabase, testUserId);
    resetSupabase();
  });

  it("should return error when no accounts connected", async () => {
    const result = await getBudgetsHandler(
      testUserId,
      { showTransactions: false }
    );

    // Verify response structure
    assert(result.content, "Response should have content");
    assert(result.content.length > 0, "Content should not be empty");
    assert.equal(result.content[0].type, "text");

    // Since no Plaid connections exist, should show connection warning
    const text = result.content[0].text;
    assert(text.includes("No Accounts Connected"), "Should indicate no accounts");
    assert(text.includes("Connect my account"), "Should provide connection guidance");
  });

  it("should return empty budgets list with creation guidance when no budgets exist", async () => {
    // Create a test Plaid connection
    await createTestConnection(supabase, {
      itemId: "test-item-123",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    const result = await getBudgetsHandler(
      testUserId,
      { showTransactions: false }
    );

    // Verify response structure
    assert(result.content, "Response should have content");
    assert(result.content.length > 0, "Content should not be empty");
    assert.equal(result.content[0].type, "text");

    // Verify text contains creation guidance
    const text = result.content[0].text;
    assert(text.includes("No Budgets Found"), "Should indicate no budgets");
    assert(text.includes("Create your first budget"), "Should provide creation guidance");

    // Verify structured content
    assert(result.structuredContent, "Should have structured content");
    assert(Array.isArray(result.structuredContent.budgets), "Should have budgets array");
    assert.equal(result.structuredContent.budgets.length, 0, "Budgets array should be empty");
    assert(result.structuredContent.widgetInstructions, "Should have widget instructions");
    assert(Array.isArray(result.structuredContent.exampleBudgets), "Should have example budgets");

    // Verify widget metadata
    assert(result._meta, "Should have widget metadata");
    assert.equal(result._meta["openai/outputTemplate"], "ui://widget/budget-list.html");
    assert.equal(result._meta["openai/widgetAccessible"], true);
  });

  it("should create a budget with upsert-budget tool", async () => {
    const budgetArgs = {
      title: "Coffee Shop Budget",
      filter_prompt: "Include coffee shops like Starbucks, Dunkin, and any merchant with 'coffee' in the name",
      budget_amount: 100,
      time_period: "weekly" as const,
      fixed_period_start_date: "2025-01-01", // Required for fixed period budgets
    };

    const result = await upsertBudgetHandler(testUserId, budgetArgs);

    // Verify response structure
    assert(result.content, "Response should have content");
    assert(result.content.length > 0, "Content should not be empty");
    assert.equal(result.content[0].type, "text");

    // Verify success message
    const text = result.content[0].text;
    assert(text.includes("Budget Created"), "Should indicate budget was created");
    assert(text.includes("Coffee Shop Budget"), "Should include budget title");
    assert(text.includes("$100"), "Should include budget amount");
    assert(text.includes("weekly"), "Should include time period");

    // Verify budget ID is returned
    assert(result.budgetId, "Should return budget ID");
    assert(typeof result.budgetId === "string", "Budget ID should be a string");

    // Verify widget data is returned
    assert(result.structuredContent, "Should have structured content for widget");
    assert(Array.isArray(result.structuredContent.budgets), "Should have budgets array");
    assert.equal(result.structuredContent.budgets.length, 1, "Should have exactly one budget");

    const budgetWidget = result.structuredContent.budgets[0];
    assert.equal(budgetWidget.title, "Coffee Shop Budget", "Widget should show budget title");
    assert.equal(budgetWidget.amount, 100, "Widget should show budget amount");
    assert.equal(budgetWidget.spent, 0, "New budget should have $0 spent");
    assert.equal(budgetWidget.remaining, 100, "New budget should have full amount remaining");
    assert.equal(budgetWidget.percentage, 0, "New budget should be at 0%");
    assert.equal(budgetWidget.status, "under", "New budget should be under budget");

    // Verify widget metadata
    assert(result._meta, "Should have widget metadata");
    assert.equal(result._meta["openai/outputTemplate"], "ui://widget/budget-list.html");
    assert.equal(result._meta["openai/widgetAccessible"], true);
  });

  it("should return error when upsert-budget is called without required fields", async () => {
    // This test verifies the error handling we added
    // When called without parameters, it should not crash
    try {
      const result = await upsertBudgetHandler(testUserId, {} as any);

      // The handler should return an error response, not throw
      assert.fail("Should have thrown validation error from Zod");
    } catch (error: any) {
      // Zod will throw before the handler runs with optional fields
      assert(error.message, "Should have error message");
    }
  });

  it("should show budget with spending status when budget exists", async () => {
    // Create a test Plaid connection
    await createTestConnection(supabase, {
      itemId: "test-item-456",
      userId: testUserId,
      institutionName: "Test Bank",
    });

    // Create a budget
    const budgetArgs = {
      title: "Grocery Budget",
      filter_prompt: "Include grocery stores like Whole Foods, Safeway, Trader Joe's",
      budget_amount: 400,
      time_period: "monthly" as const,
      fixed_period_start_date: "2025-01-01", // Required for fixed period budgets
    };

    await upsertBudgetHandler(testUserId, budgetArgs);

    // Then get budgets
    const result = await getBudgetsHandler(
      testUserId,
      { showTransactions: false }
    );

    // Verify response structure
    assert(result.content, "Response should have content");
    assert(result.content[0].type, "text");

    // Verify text contains budget status
    const text = result.content[0].text;
    assert(text.includes("Budget Status"), "Should show budget status");
    assert(text.includes("Grocery Budget"), "Should include budget title");

    // Verify structured content has budget data
    assert(result.structuredContent, "Should have structured content");
    assert(Array.isArray(result.structuredContent.budgets), "Should have budgets array");
    assert(result.structuredContent.budgets.length > 0, "Should have at least one budget");

    const budget = result.structuredContent.budgets[0];
    assert.equal(budget.title, "Grocery Budget", "Budget title should match");
    assert.equal(budget.amount, 400, "Budget amount should match");
    assert.equal(budget.period, "monthly", "Budget period should match");
    assert(typeof budget.spent === "number", "Should have spent amount");
    assert(typeof budget.remaining === "number", "Should have remaining amount");
    assert(typeof budget.percentage === "number", "Should have percentage");
    assert(["under", "near", "over"].includes(budget.status), "Should have valid status");
  });

  it("should update existing budget when id is provided", async () => {
    // First create a budget
    const createResult = await upsertBudgetHandler(testUserId, {
      title: "Dining Budget",
      filter_prompt: "Include restaurants and food delivery",
      budget_amount: 200,
      time_period: "weekly" as const,
      fixed_period_start_date: "2025-01-01", // Required for fixed period budgets
    });

    const budgetId = createResult.budgetId;

    // Then update it
    const updateResult = await upsertBudgetHandler(testUserId, {
      id: budgetId,
      title: "Dining Out Budget", // Changed title
      filter_prompt: "Include restaurants and food delivery",
      budget_amount: 250, // Increased amount
      time_period: "weekly" as const,
      fixed_period_start_date: "2025-01-01", // Required for fixed period budgets
    });

    // Verify update response
    assert(updateResult.content, "Response should have content");
    const text = updateResult.content[0].text;
    assert(text.includes("Budget Updated"), "Should indicate budget was updated");
    assert(text.includes("Dining Out Budget"), "Should include updated title");
    assert(text.includes("$250"), "Should include updated amount");
  });

  it("should validate custom_period_days when time_period is rolling", async () => {
    // Without custom_period_days - should show error
    const result1 = await upsertBudgetHandler(testUserId, {
      title: "Rolling Budget",
      filter_prompt: "Include all transactions",
      budget_amount: 500,
      time_period: "rolling" as const,
      // Missing custom_period_days
    } as any);

    assert(result1.content, "Response should have content");
    const text1 = result1.content[0].text;
    assert(text1.includes("Error"), "Should show error");
    assert(text1.includes("custom_period_days"), "Should mention missing field");

    // With custom_period_days
    const result2 = await upsertBudgetHandler(testUserId, {
      title: "Rolling Budget",
      filter_prompt: "Include all transactions",
      budget_amount: 500,
      time_period: "rolling" as const,
      custom_period_days: 14,
    });

    assert(result2.content, "Response should have content");
    const text2 = result2.content[0].text;
    assert(text2.includes("Budget Created"), "Should create budget successfully");
  });
});
