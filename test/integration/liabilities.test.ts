/**
 * Liabilities Integration Tests
 * Tests the get-liabilities tool with real local Supabase database
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { MockPlaidClient } from "../mocks/plaid-mock.js";
import {
  createTestSupabaseClient,
  cleanupTestUser,
  createTestConnection,
} from "../helpers/test-db.js";
import {
  getLiabilitiesByUserId,
  upsertCreditLiabilities,
  upsertMortgageLiabilities,
  upsertStudentLiabilities,
} from "../../src/storage/repositories/liabilities.js";
import { upsertAccounts } from "../../src/storage/repositories/accounts.js";
import { getLiabilitiesHandler } from "../../src/tools/liabilities/get-liabilities.js";

describe("Liabilities Integration", () => {
  const testUserId = "test-liabilities-user";
  const supabase = createTestSupabaseClient(testUserId);
  const mockPlaidClient = new MockPlaidClient() as any;
  const testItemId = "item-test-liabilities-123";
  const testAccessToken = `access-test-${testItemId}`;

  beforeEach(async () => {
    // Clean up any existing test data
    await cleanupTestUser(supabase, testUserId);

    // Create test connection
    await createTestConnection(supabase, {
      itemId: testItemId,
      userId: testUserId,
      institutionName: "Mock Bank",
    });
  });

  afterEach(async () => {
    // Clean up test data
    await cleanupTestUser(supabase, testUserId);
  });

  it("should fetch and store liabilities from Plaid", async () => {
    // Setup: Get mock accounts and create them in database
    const accountsResponse = await mockPlaidClient.accountsGet({
      access_token: testAccessToken,
    });

    const accounts = accountsResponse.data.accounts.map((acc: any) => ({
      account_id: acc.account_id,
      name: acc.name,
      official_name: acc.official_name,
      type: acc.type,
      subtype: acc.subtype,
      balances: {
        current: acc.balances.current,
        available: acc.balances.available,
        limit: acc.balances.limit,
        iso_currency_code: acc.balances.iso_currency_code,
      },
    }));

    await upsertAccounts(testUserId, testItemId, accounts);

    // Fetch liabilities from Plaid mock
    const response = await mockPlaidClient.liabilitiesGet({
      access_token: testAccessToken,
    });

    const { liabilities } = response.data;

    // Store credit card liabilities
    if (liabilities.credit) {
      for (const credit of liabilities.credit) {
        await upsertCreditLiabilities(testUserId, credit.account_id!, credit);
      }
    }

    // Store mortgage liabilities
    if (liabilities.mortgage) {
      for (const mortgage of liabilities.mortgage) {
        await upsertMortgageLiabilities(testUserId, mortgage.account_id, mortgage);
      }
    }

    // Store student loan liabilities
    if (liabilities.student) {
      for (const student of liabilities.student) {
        await upsertStudentLiabilities(testUserId, student.account_id!, student);
      }
    }

    // Verify: Check liabilities were stored
    const storedLiabilities = await getLiabilitiesByUserId(testUserId);

    assert.equal(storedLiabilities.length, 3); // 1 credit, 1 mortgage, 1 student

    // Verify credit card liability
    const creditLiability = storedLiabilities.find((l) => l.type === "credit");
    assert(creditLiability);
    assert.equal(creditLiability.account_id, "acc_credit_card_202");
    assert.equal(creditLiability.account_name, "Mock Credit Card");
    const creditData = creditLiability.data as any;
    assert.equal(creditData.minimum_payment_amount, 35.00);
    assert.equal(creditData.is_overdue, false);
    assert(Array.isArray(creditData.aprs));
    assert.equal(creditData.aprs.length, 2);

    // Verify mortgage liability
    const mortgageLiability = storedLiabilities.find((l) => l.type === "mortgage");
    assert(mortgageLiability);
    assert.equal(mortgageLiability.account_id, "acc_mortgage_303");
    const mortgageData = mortgageLiability.data as any;
    assert.equal(mortgageData.loan_term, "30 year");
    assert.equal(mortgageData.interest_rate_percentage, 3.75);
    assert.equal(mortgageData.has_pmi, true);
    assert(mortgageData.property_address);
    assert.equal(mortgageData.property_address.city, "San Francisco");

    // Verify student loan liability
    const studentLiability = storedLiabilities.find((l) => l.type === "student");
    assert(studentLiability);
    assert.equal(studentLiability.account_id, "acc_student_loan_404");
    const studentData = studentLiability.data as any;
    assert.equal(studentData.guarantor, "DEPT OF ED");
    assert.equal(studentData.interest_rate_percentage, 4.5);
    assert(studentData.loan_status);
    assert.equal(studentData.loan_status.type, "repayment");
  });

  it("should filter liabilities by type", async () => {
    // Setup: Get mock accounts and create them in database
    const accountsResponse = await mockPlaidClient.accountsGet({
      access_token: testAccessToken,
    });

    const accounts = accountsResponse.data.accounts.map((acc: any) => ({
      account_id: acc.account_id,
      name: acc.name,
      official_name: acc.official_name,
      type: acc.type,
      subtype: acc.subtype,
      balances: {
        current: acc.balances.current,
        available: acc.balances.available,
        limit: acc.balances.limit,
        iso_currency_code: acc.balances.iso_currency_code,
      },
    }));

    await upsertAccounts(testUserId, testItemId, accounts);

    // Store all liabilities
    const response = await mockPlaidClient.liabilitiesGet({
      access_token: testAccessToken,
    });
    const { liabilities } = response.data;

    for (const credit of liabilities.credit || []) {
      await upsertCreditLiabilities(testUserId, credit.account_id!, credit);
    }
    for (const mortgage of liabilities.mortgage || []) {
      await upsertMortgageLiabilities(testUserId, mortgage.account_id, mortgage);
    }
    for (const student of liabilities.student || []) {
      await upsertStudentLiabilities(testUserId, student.account_id!, student);
    }

    // Test: Filter by credit
    const creditOnly = await getLiabilitiesByUserId(testUserId, "credit");
    assert.equal(creditOnly.length, 1);
    assert.equal(creditOnly[0].type, "credit");

    // Test: Filter by mortgage
    const mortgageOnly = await getLiabilitiesByUserId(testUserId, "mortgage");
    assert.equal(mortgageOnly.length, 1);
    assert.equal(mortgageOnly[0].type, "mortgage");

    // Test: Filter by student
    const studentOnly = await getLiabilitiesByUserId(testUserId, "student");
    assert.equal(studentOnly.length, 1);
    assert.equal(studentOnly[0].type, "student");
  });

  it("should handle get-liabilities tool with Plaid fetch", async () => {
    // Setup: Create accounts first (required for foreign key)
    const accountsResponse = await mockPlaidClient.accountsGet({
      access_token: testAccessToken,
    });

    const accounts = accountsResponse.data.accounts.map((acc: any) => ({
      account_id: acc.account_id,
      name: acc.name,
      official_name: acc.official_name,
      type: acc.type,
      subtype: acc.subtype,
      balances: {
        current: acc.balances.current,
        available: acc.balances.available,
        limit: acc.balances.limit,
        iso_currency_code: acc.balances.iso_currency_code,
      },
    }));

    await upsertAccounts(testUserId, testItemId, accounts);

    // Execute: Call handler (should fetch from Plaid and store)
    const result = await getLiabilitiesHandler(
      testUserId,
      undefined,
      mockPlaidClient
    );

    // Verify response structure
    assert(result.content);
    assert.equal(result.content.length, 1);
    assert.equal(result.content[0].type, "text");
    assert(result.content[0].text.includes("Liabilities Overview"));

    // Verify structured content
    assert(result.structuredContent);
    assert(result.structuredContent.liabilities);
    assert(result.structuredContent.summary);
    assert.equal(result.structuredContent.summary.totalLiabilities, 3);
    assert.equal(result.structuredContent.summary.creditCount, 1);
    assert.equal(result.structuredContent.summary.mortgageCount, 1);
    assert.equal(result.structuredContent.summary.studentCount, 1);

    // Verify data was persisted to database
    const storedLiabilities = await getLiabilitiesByUserId(testUserId);
    assert.equal(storedLiabilities.length, 3);
  });

  it("should handle get-liabilities tool with type filter", async () => {
    // Setup: Create accounts and liabilities
    const accountsResponse = await mockPlaidClient.accountsGet({
      access_token: testAccessToken,
    });

    const accounts = accountsResponse.data.accounts.map((acc: any) => ({
      account_id: acc.account_id,
      name: acc.name,
      official_name: acc.official_name,
      type: acc.type,
      subtype: acc.subtype,
      balances: {
        current: acc.balances.current,
        available: acc.balances.available,
        limit: acc.balances.limit,
        iso_currency_code: acc.balances.iso_currency_code,
      },
    }));

    await upsertAccounts(testUserId, testItemId, accounts);

    // First call to populate data
    await getLiabilitiesHandler(testUserId, undefined, mockPlaidClient);

    // Test: Filter by credit only
    const creditResult = await getLiabilitiesHandler(
      testUserId,
      "credit",
      mockPlaidClient
    );

    assert(creditResult.structuredContent);
    assert.equal(creditResult.structuredContent.liabilities.length, 1);
    assert.equal(creditResult.structuredContent.liabilities[0].type, "credit");
    assert(creditResult.content[0].text.includes("Credit Cards"));
  });

  it("should return empty result when no liabilities exist", async () => {
    // Execute: Call handler with no liabilities
    const result = await getLiabilitiesHandler(
      testUserId,
      undefined,
      mockPlaidClient
    );

    // Verify response
    assert(result.content);
    assert.equal(result.content.length, 1);
    assert(result.content[0].text.includes("No liabilities found"));
  });
});
