/**
 * Integration tests for accounts, liabilities, and investment holdings RLS policies.
 * Verifies per-user isolation for read/update/delete operations.
 */

import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert";
import {
  createTestSupabaseClient,
  createTestSupabaseAdminClient,
  cleanupTestUser,
  createTestConnection,
} from "../helpers/test-db.js";

describe("Sensitive financial tables RLS", () => {
  const userA = "test-rls-sensitive-a";
  const userB = "test-rls-sensitive-b";
  const supabaseUserA = createTestSupabaseClient(userA);
  const supabaseUserB = createTestSupabaseClient(userB);
  const adminSupabase = createTestSupabaseAdminClient();

  let userAAccountId: string;
  let userBAccountId: string;
  let userAAccountRowId: string;
  let userBAccountRowId: string;
  let userAHoldingId: string;
  let userBHoldingId: string;
  let userACreditLiabilityId: string;
  let userBCreditLiabilityId: string;
  let userAMortgageLiabilityId: string;
  let userBMortgageLiabilityId: string;
  let userAStudentLiabilityId: string;
  let userBStudentLiabilityId: string;

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
    userAAccountId = `acc_${timestamp}_a`;
    userBAccountId = `acc_${timestamp}_b`;

    const { data: accounts, error: accountError } = await adminSupabase
      .from("accounts")
      .insert([
        {
          user_id: userA,
          item_id: `item_${userA}`,
          account_id: userAAccountId,
          name: "User A Checking",
          official_name: null,
          type: "depository",
          subtype: "checking",
          current_balance: 1250.5,
          available_balance: 1200.5,
          limit_amount: null,
          currency_code: "USD",
          last_synced_at: new Date().toISOString(),
        },
        {
          user_id: userB,
          item_id: `item_${userB}`,
          account_id: userBAccountId,
          name: "User B Savings",
          official_name: null,
          type: "depository",
          subtype: "savings",
          current_balance: 4200.75,
          available_balance: 4200.75,
          limit_amount: null,
          currency_code: "USD",
          last_synced_at: new Date().toISOString(),
        },
      ])
      .select("id, account_id, user_id");

    if (accountError) {
      throw new Error(`Failed to seed accounts: ${accountError.message}`);
    }

    userAAccountRowId = accounts![0].id;
    userBAccountRowId = accounts![1].id;

    const { data: holdings, error: holdingError } = await adminSupabase
      .from("investment_holdings")
      .insert([
        {
          user_id: userA,
          account_id: userAAccountId,
          security_id: `sec_${timestamp}_a`,
          quantity: 10,
          institution_price: 100,
          institution_price_as_of: new Date().toISOString(),
          institution_value: 1000,
          cost_basis: 800,
          ticker_symbol: "TESTA",
          security_name: "Test Security A",
          security_type: "equity",
          security_subtype: "common",
          close_price: 100,
          close_price_as_of: new Date().toISOString(),
          iso_currency_code: "USD",
          unofficial_currency_code: null,
          last_synced_at: new Date().toISOString(),
        },
        {
          user_id: userB,
          account_id: userBAccountId,
          security_id: `sec_${timestamp}_b`,
          quantity: 5,
          institution_price: 200,
          institution_price_as_of: new Date().toISOString(),
          institution_value: 1000,
          cost_basis: 750,
          ticker_symbol: "TESTB",
          security_name: "Test Security B",
          security_type: "equity",
          security_subtype: "etf",
          close_price: 200,
          close_price_as_of: new Date().toISOString(),
          iso_currency_code: "USD",
          unofficial_currency_code: null,
          last_synced_at: new Date().toISOString(),
        },
      ])
      .select("id, user_id");

    if (holdingError) {
      throw new Error(`Failed to seed holdings: ${holdingError.message}`);
    }

    userAHoldingId = holdings![0].id;
    userBHoldingId = holdings![1].id;

    const { data: liabilitiesCredit, error: creditError } = await adminSupabase
      .from("liabilities_credit")
      .insert([
        {
          user_id: userA,
          account_id: userAAccountId,
          aprs: null,
          is_overdue: false,
          last_payment_amount: 50,
          last_payment_date: "2024-01-15",
          last_statement_issue_date: "2024-01-01",
          last_statement_balance: 500,
          minimum_payment_amount: 25,
          next_payment_due_date: "2024-02-01",
          last_synced_at: new Date().toISOString(),
        },
        {
          user_id: userB,
          account_id: userBAccountId,
          aprs: null,
          is_overdue: false,
          last_payment_amount: 75,
          last_payment_date: "2024-01-10",
          last_statement_issue_date: "2024-01-05",
          last_statement_balance: 750,
          minimum_payment_amount: 35,
          next_payment_due_date: "2024-02-05",
          last_synced_at: new Date().toISOString(),
        },
      ])
      .select("id, user_id");

    if (creditError) {
      throw new Error(`Failed to seed credit liabilities: ${creditError.message}`);
    }

    userACreditLiabilityId = liabilitiesCredit![0].id;
    userBCreditLiabilityId = liabilitiesCredit![1].id;

    const { data: liabilitiesMortgage, error: mortgageError } = await adminSupabase
      .from("liabilities_mortgage")
      .insert([
        {
          user_id: userA,
          account_id: userAAccountId,
          loan_term: "30 year",
          loan_type_description: "fixed",
          origination_date: "2020-01-01",
          origination_principal_amount: 300000,
          maturity_date: "2050-01-01",
          interest_rate_percentage: 3.75,
          interest_rate_type: "fixed",
          property_address: null,
          next_payment_due_date: "2024-02-01",
          next_monthly_payment: 1500,
          last_payment_date: "2024-01-01",
          last_payment_amount: 1500,
          current_late_fee: 0,
          past_due_amount: 0,
          escrow_balance: 2500,
          has_pmi: false,
          has_prepayment_penalty: false,
          ytd_interest_paid: 1800,
          ytd_principal_paid: 1200,
          last_synced_at: new Date().toISOString(),
        },
        {
          user_id: userB,
          account_id: userBAccountId,
          loan_term: "15 year",
          loan_type_description: "fixed",
          origination_date: "2022-06-01",
          origination_principal_amount: 200000,
          maturity_date: "2037-06-01",
          interest_rate_percentage: 4.25,
          interest_rate_type: "fixed",
          property_address: null,
          next_payment_due_date: "2024-02-10",
          next_monthly_payment: 1200,
          last_payment_date: "2024-01-10",
          last_payment_amount: 1200,
          current_late_fee: 0,
          past_due_amount: 0,
          escrow_balance: 1500,
          has_pmi: true,
          has_prepayment_penalty: false,
          ytd_interest_paid: 900,
          ytd_principal_paid: 700,
          last_synced_at: new Date().toISOString(),
        },
      ])
      .select("id, user_id");

    if (mortgageError) {
      throw new Error(`Failed to seed mortgage liabilities: ${mortgageError.message}`);
    }

    userAMortgageLiabilityId = liabilitiesMortgage![0].id;
    userBMortgageLiabilityId = liabilitiesMortgage![1].id;

    const { data: liabilitiesStudent, error: studentError } = await adminSupabase
      .from("liabilities_student")
      .insert([
        {
          user_id: userA,
          account_id: userAAccountId,
          loan_name: "Student Loan A",
          guarantor: "DOE",
          interest_rate_percentage: 5.5,
          loan_status: null,
          repayment_plan: null,
          disbursement_dates: null,
          origination_date: "2015-09-01",
          expected_payoff_date: "2035-09-01",
          is_overdue: false,
          minimum_payment_amount: 300,
          next_payment_due_date: "2024-02-15",
          last_payment_date: "2024-01-15",
          last_payment_amount: 300,
          payment_reference_number: "REF-A",
          origination_principal_amount: 50000,
          outstanding_interest_amount: 2500,
          last_statement_balance: 45000,
          last_statement_issue_date: "2024-01-01",
          servicer_address: null,
          ytd_interest_paid: 150,
          ytd_principal_paid: 200,
          last_synced_at: new Date().toISOString(),
        },
        {
          user_id: userB,
          account_id: userBAccountId,
          loan_name: "Student Loan B",
          guarantor: "DOE",
          interest_rate_percentage: 4.2,
          loan_status: null,
          repayment_plan: null,
          disbursement_dates: null,
          origination_date: "2016-09-01",
          expected_payoff_date: "2032-09-01",
          is_overdue: false,
          minimum_payment_amount: 250,
          next_payment_due_date: "2024-02-12",
          last_payment_date: "2024-01-12",
          last_payment_amount: 250,
          payment_reference_number: "REF-B",
          origination_principal_amount: 40000,
          outstanding_interest_amount: 2100,
          last_statement_balance: 32000,
          last_statement_issue_date: "2024-01-01",
          servicer_address: null,
          ytd_interest_paid: 120,
          ytd_principal_paid: 180,
          last_synced_at: new Date().toISOString(),
        },
      ])
      .select("id, user_id");

    if (studentError) {
      throw new Error(`Failed to seed student liabilities: ${studentError.message}`);
    }

    userAStudentLiabilityId = liabilitiesStudent![0].id;
    userBStudentLiabilityId = liabilitiesStudent![1].id;
  });

  after(async () => {
    await cleanupTestUser(adminSupabase, userA);
    await cleanupTestUser(adminSupabase, userB);
  });

  it("restricts accounts table access to owning user", async () => {
    const { data: userAAccounts, error: userAError } = await supabaseUserA
      .from("accounts")
      .select("account_id,user_id");

    assert.ifError(userAError);
    assert(userAAccounts);
    assert.equal(userAAccounts.length, 1);
    assert.equal(userAAccounts[0].account_id, userAAccountId);
    assert.equal(userAAccounts[0].user_id, userA);

    const { data: userBView, error: userBViewError } = await supabaseUserB
      .from("accounts")
      .select("account_id")
      .eq("account_id", userAAccountId);

    assert.ifError(userBViewError);
    assert.equal(userBView?.length ?? 0, 0, "User B must not see user A account");

    const { data: updateAttempt, error: updateError } = await supabaseUserB
      .from("accounts")
      .update({ name: "Hacked Account" })
      .eq("id", userAAccountRowId)
      .select("id");

    assert.ifError(updateError);
    assert.equal(updateAttempt?.length ?? 0, 0, "User B must not update user A account");

    const { data: deleteAttempt, error: deleteError } = await supabaseUserB
      .from("accounts")
      .delete()
      .eq("id", userAAccountRowId)
      .select("id");

    assert.ifError(deleteError);
    assert.equal(deleteAttempt?.length ?? 0, 0, "User B must not delete user A account");
  });

  it("restricts investment holdings access to owning user", async () => {
    const { data: userAHoldings, error: userAHoldingsError } = await supabaseUserA
      .from("investment_holdings")
      .select("id,user_id");

    assert.ifError(userAHoldingsError);
    assert(userAHoldings);
    assert.equal(userAHoldings.length, 1);
    assert.equal(userAHoldings[0].id, userAHoldingId);
    assert.equal(userAHoldings[0].user_id, userA);

    const { data: userBHoldingView, error: userBHoldingViewError } = await supabaseUserB
      .from("investment_holdings")
      .select("id")
      .eq("id", userAHoldingId);

    assert.ifError(userBHoldingViewError);
    assert.equal(userBHoldingView?.length ?? 0, 0, "User B must not see user A holding");

    const { data: updateAttempt, error: updateError } = await supabaseUserB
      .from("investment_holdings")
      .update({ quantity: 999 })
      .eq("id", userAHoldingId)
      .select("id");

    assert.ifError(updateError);
    assert.equal(updateAttempt?.length ?? 0, 0, "User B must not update user A holding");

    const { data: deleteAttempt, error: deleteError } = await supabaseUserB
      .from("investment_holdings")
      .delete()
      .eq("id", userAHoldingId)
      .select("id");

    assert.ifError(deleteError);
    assert.equal(deleteAttempt?.length ?? 0, 0, "User B must not delete user A holding");
  });

  it("restricts liabilities tables access to owning user", async () => {
    const { data: creditRows, error: creditError } = await supabaseUserA
      .from("liabilities_credit")
      .select("id,user_id");
    assert.ifError(creditError);
    assert(creditRows);
    assert.equal(creditRows.length, 1);
    assert.equal(creditRows[0].id, userACreditLiabilityId);
    assert.equal(creditRows[0].user_id, userA);

    const { data: creditCrossView, error: creditCrossError } = await supabaseUserB
      .from("liabilities_credit")
      .select("id")
      .eq("id", userACreditLiabilityId);
    assert.ifError(creditCrossError);
    assert.equal(creditCrossView?.length ?? 0, 0, "User B must not see user A credit liability");

    const { data: creditUpdate, error: creditUpdateError } = await supabaseUserB
      .from("liabilities_credit")
      .update({ is_overdue: true })
      .eq("id", userACreditLiabilityId)
      .select("id");
    assert.ifError(creditUpdateError);
    assert.equal(creditUpdate?.length ?? 0, 0, "User B must not update user A credit liability");

    const { data: creditDelete, error: creditDeleteError } = await supabaseUserB
      .from("liabilities_credit")
      .delete()
      .eq("id", userACreditLiabilityId)
      .select("id");
    assert.ifError(creditDeleteError);
    assert.equal(creditDelete?.length ?? 0, 0, "User B must not delete user A credit liability");

    const { data: mortgageRows, error: mortgageError } = await supabaseUserA
      .from("liabilities_mortgage")
      .select("id,user_id");
    assert.ifError(mortgageError);
    assert(mortgageRows);
    assert.equal(mortgageRows.length, 1);
    assert.equal(mortgageRows[0].id, userAMortgageLiabilityId);

    const { data: mortgageCrossView, error: mortgageCrossError } = await supabaseUserB
      .from("liabilities_mortgage")
      .select("id")
      .eq("id", userAMortgageLiabilityId);
    assert.ifError(mortgageCrossError);
    assert.equal(mortgageCrossView?.length ?? 0, 0, "User B must not see user A mortgage liability");

    const { data: mortgageUpdate, error: mortgageUpdateError } = await supabaseUserB
      .from("liabilities_mortgage")
      .update({ interest_rate_percentage: 99 })
      .eq("id", userAMortgageLiabilityId)
      .select("id");
    assert.ifError(mortgageUpdateError);
    assert.equal(mortgageUpdate?.length ?? 0, 0, "User B must not update user A mortgage liability");

    const { data: mortgageDelete, error: mortgageDeleteError } = await supabaseUserB
      .from("liabilities_mortgage")
      .delete()
      .eq("id", userAMortgageLiabilityId)
      .select("id");
    assert.ifError(mortgageDeleteError);
    assert.equal(mortgageDelete?.length ?? 0, 0, "User B must not delete user A mortgage liability");

    const { data: studentRows, error: studentError } = await supabaseUserA
      .from("liabilities_student")
      .select("id,user_id");
    assert.ifError(studentError);
    assert(studentRows);
    assert.equal(studentRows.length, 1);
    assert.equal(studentRows[0].id, userAStudentLiabilityId);

    const { data: studentCrossView, error: studentCrossError } = await supabaseUserB
      .from("liabilities_student")
      .select("id")
      .eq("id", userAStudentLiabilityId);
    assert.ifError(studentCrossError);
    assert.equal(studentCrossView?.length ?? 0, 0, "User B must not see user A student liability");

    const { data: studentUpdate, error: studentUpdateError } = await supabaseUserB
      .from("liabilities_student")
      .update({ minimum_payment_amount: 999 })
      .eq("id", userAStudentLiabilityId)
      .select("id");
    assert.ifError(studentUpdateError);
    assert.equal(studentUpdate?.length ?? 0, 0, "User B must not update user A student liability");

    const { data: studentDelete, error: studentDeleteError } = await supabaseUserB
      .from("liabilities_student")
      .delete()
      .eq("id", userAStudentLiabilityId)
      .select("id");
    assert.ifError(studentDeleteError);
    assert.equal(studentDelete?.length ?? 0, 0, "User B must not delete user A student liability");
  });
});
