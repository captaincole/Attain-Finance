/**
 * Liabilities Repository
 * Database operations for liability data from Plaid Liabilities API
 * Supports credit cards, mortgages, and student loans
 */

import { getSupabase } from "../supabase.js";
import type { Database } from "../database.types.js";
import type {
  CreditCardLiability,
  MortgageLiability,
  StudentLoan,
} from "plaid";

type CreditLiabilityRow = Database["public"]["Tables"]["liabilities_credit"]["Row"];
type CreditLiabilityInsert = Database["public"]["Tables"]["liabilities_credit"]["Insert"];
type MortgageLiabilityRow = Database["public"]["Tables"]["liabilities_mortgage"]["Row"];
type MortgageLiabilityInsert = Database["public"]["Tables"]["liabilities_mortgage"]["Insert"];
type StudentLiabilityRow = Database["public"]["Tables"]["liabilities_student"]["Row"];
type StudentLiabilityInsert = Database["public"]["Tables"]["liabilities_student"]["Insert"];

export interface LiabilityWithAccount {
  type: "credit" | "mortgage" | "student";
  account_id: string;
  account_name?: string;
  account_type?: string;
  account_subtype?: string;
  data: CreditLiabilityRow | MortgageLiabilityRow | StudentLiabilityRow;
}

/**
 * Upsert credit card liabilities for an account
 */
export async function upsertCreditLiabilities(
  userId: string,
  accountId: string,
  creditData: CreditCardLiability
): Promise<void> {
  const supabase = getSupabase();

  const creditToInsert: CreditLiabilityInsert = {
    user_id: userId,
    account_id: accountId,
    aprs: creditData.aprs ? JSON.parse(JSON.stringify(creditData.aprs)) : null,
    is_overdue: creditData.is_overdue ?? null,
    last_payment_amount: creditData.last_payment_amount ?? null,
    last_payment_date: creditData.last_payment_date ?? null,
    last_statement_issue_date: creditData.last_statement_issue_date ?? null,
    last_statement_balance: creditData.last_statement_balance ?? null,
    minimum_payment_amount: creditData.minimum_payment_amount ?? null,
    next_payment_due_date: creditData.next_payment_due_date ?? null,
    last_synced_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("liabilities_credit")
    .upsert(creditToInsert, {
      onConflict: "account_id",
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(`Failed to upsert credit liability: ${error.message}`);
  }
}

/**
 * Upsert mortgage liabilities for an account
 */
export async function upsertMortgageLiabilities(
  userId: string,
  accountId: string,
  mortgageData: MortgageLiability
): Promise<void> {
  const supabase = getSupabase();

  const mortgageToInsert: MortgageLiabilityInsert = {
    user_id: userId,
    account_id: accountId,
    account_number: mortgageData.account_number ?? null,
    loan_term: mortgageData.loan_term ?? null,
    loan_type_description: mortgageData.loan_type_description ?? null,
    origination_date: mortgageData.origination_date ?? null,
    origination_principal_amount: mortgageData.origination_principal_amount ?? null,
    maturity_date: mortgageData.maturity_date ?? null,
    interest_rate_percentage: mortgageData.interest_rate?.percentage ?? null,
    interest_rate_type: mortgageData.interest_rate?.type ?? null,
    property_address: mortgageData.property_address
      ? JSON.parse(JSON.stringify(mortgageData.property_address))
      : null,
    next_payment_due_date: mortgageData.next_payment_due_date ?? null,
    next_monthly_payment: mortgageData.next_monthly_payment ?? null,
    last_payment_date: mortgageData.last_payment_date ?? null,
    last_payment_amount: mortgageData.last_payment_amount ?? null,
    current_late_fee: mortgageData.current_late_fee ?? null,
    past_due_amount: mortgageData.past_due_amount ?? null,
    escrow_balance: mortgageData.escrow_balance ?? null,
    has_pmi: mortgageData.has_pmi ?? null,
    has_prepayment_penalty: mortgageData.has_prepayment_penalty ?? null,
    ytd_interest_paid: mortgageData.ytd_interest_paid ?? null,
    ytd_principal_paid: mortgageData.ytd_principal_paid ?? null,
    last_synced_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("liabilities_mortgage")
    .upsert(mortgageToInsert, {
      onConflict: "account_id",
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(`Failed to upsert mortgage liability: ${error.message}`);
  }
}

/**
 * Upsert student loan liabilities for an account
 */
export async function upsertStudentLiabilities(
  userId: string,
  accountId: string,
  studentData: StudentLoan
): Promise<void> {
  const supabase = getSupabase();

  const studentToInsert: StudentLiabilityInsert = {
    user_id: userId,
    account_id: accountId,
    account_number: studentData.account_number ?? null,
    sequence_number: studentData.sequence_number ?? null,
    loan_name: studentData.loan_name ?? null,
    guarantor: studentData.guarantor ?? null,
    interest_rate_percentage: studentData.interest_rate_percentage ?? null,
    loan_status: studentData.loan_status
      ? JSON.parse(JSON.stringify(studentData.loan_status))
      : null,
    repayment_plan: studentData.repayment_plan
      ? JSON.parse(JSON.stringify(studentData.repayment_plan))
      : null,
    disbursement_dates: studentData.disbursement_dates
      ? JSON.parse(JSON.stringify(studentData.disbursement_dates))
      : null,
    origination_date: studentData.origination_date ?? null,
    expected_payoff_date: studentData.expected_payoff_date ?? null,
    is_overdue: studentData.is_overdue ?? null,
    minimum_payment_amount: studentData.minimum_payment_amount ?? null,
    next_payment_due_date: studentData.next_payment_due_date ?? null,
    last_payment_date: studentData.last_payment_date ?? null,
    last_payment_amount: studentData.last_payment_amount ?? null,
    payment_reference_number: studentData.payment_reference_number ?? null,
    origination_principal_amount: studentData.origination_principal_amount ?? null,
    outstanding_interest_amount: studentData.outstanding_interest_amount ?? null,
    last_statement_balance: studentData.last_statement_balance ?? null,
    last_statement_issue_date: studentData.last_statement_issue_date ?? null,
    servicer_address: studentData.servicer_address
      ? JSON.parse(JSON.stringify(studentData.servicer_address))
      : null,
    ytd_interest_paid: studentData.ytd_interest_paid ?? null,
    ytd_principal_paid: studentData.ytd_principal_paid ?? null,
    last_synced_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("liabilities_student")
    .upsert(studentToInsert, {
      onConflict: "account_id",
      ignoreDuplicates: false,
    });

  if (error) {
    throw new Error(`Failed to upsert student liability: ${error.message}`);
  }
}

/**
 * Get all liabilities for a user, optionally filtered by type
 * @param userId - User ID
 * @param type - Optional filter: "credit", "mortgage", or "student"
 * @returns Array of liabilities with account information
 */
export async function getLiabilitiesByUserId(
  userId: string,
  type?: "credit" | "mortgage" | "student"
): Promise<LiabilityWithAccount[]> {
  const supabase = getSupabase();
  const results: LiabilityWithAccount[] = [];

  // Fetch credit card liabilities
  if (!type || type === "credit") {
    const { data, error } = await supabase
      .from("liabilities_credit")
      .select(`
        *,
        accounts:account_id(name, type, subtype)
      `)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to fetch credit liabilities: ${error.message}`);
    }

    if (data) {
      results.push(
        ...data.map((row) => ({
          type: "credit" as const,
          account_id: row.account_id,
          account_name: (row.accounts as any)?.name,
          account_type: (row.accounts as any)?.type,
          account_subtype: (row.accounts as any)?.subtype,
          data: row,
        }))
      );
    }
  }

  // Fetch mortgage liabilities
  if (!type || type === "mortgage") {
    const { data, error} = await supabase
      .from("liabilities_mortgage")
      .select(`
        *,
        accounts:account_id(name, type, subtype)
      `)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to fetch mortgage liabilities: ${error.message}`);
    }

    if (data) {
      results.push(
        ...data.map((row) => ({
          type: "mortgage" as const,
          account_id: row.account_id,
          account_name: (row.accounts as any)?.name,
          account_type: (row.accounts as any)?.type,
          account_subtype: (row.accounts as any)?.subtype,
          data: row,
        }))
      );
    }
  }

  // Fetch student loan liabilities
  if (!type || type === "student") {
    const { data, error } = await supabase
      .from("liabilities_student")
      .select(`
        *,
        accounts:account_id(name, type, subtype)
      `)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to fetch student liabilities: ${error.message}`);
    }

    if (data) {
      results.push(
        ...data.map((row) => ({
          type: "student" as const,
          account_id: row.account_id,
          account_name: (row.accounts as any)?.name,
          account_type: (row.accounts as any)?.type,
          account_subtype: (row.accounts as any)?.subtype,
          data: row,
        }))
      );
    }
  }

  return results;
}

/**
 * Delete all liabilities for an account (used when disconnecting)
 */
export async function deleteLiabilitiesByAccountId(accountId: string): Promise<void> {
  const supabase = getSupabase();

  // Delete from all three tables
  const creditDelete = supabase
    .from("liabilities_credit")
    .delete()
    .eq("account_id", accountId);

  const mortgageDelete = supabase
    .from("liabilities_mortgage")
    .delete()
    .eq("account_id", accountId);

  const studentDelete = supabase
    .from("liabilities_student")
    .delete()
    .eq("account_id", accountId);

  const [creditResult, mortgageResult, studentResult] = await Promise.all([
    creditDelete,
    mortgageDelete,
    studentDelete,
  ]);

  if (creditResult.error) {
    throw new Error(`Failed to delete credit liabilities: ${creditResult.error.message}`);
  }
  if (mortgageResult.error) {
    throw new Error(`Failed to delete mortgage liabilities: ${mortgageResult.error.message}`);
  }
  if (studentResult.error) {
    throw new Error(`Failed to delete student liabilities: ${studentResult.error.message}`);
  }
}

/**
 * Delete all liabilities for a user (used in cleanup/testing)
 */
export async function deleteLiabilitiesByUserId(userId: string): Promise<void> {
  const supabase = getSupabase();

  // Delete from all three tables
  const creditDelete = supabase
    .from("liabilities_credit")
    .delete()
    .eq("user_id", userId);

  const mortgageDelete = supabase
    .from("liabilities_mortgage")
    .delete()
    .eq("user_id", userId);

  const studentDelete = supabase
    .from("liabilities_student")
    .delete()
    .eq("user_id", userId);

  const [creditResult, mortgageResult, studentResult] = await Promise.all([
    creditDelete,
    mortgageDelete,
    studentDelete,
  ]);

  if (creditResult.error) {
    throw new Error(`Failed to delete credit liabilities: ${creditResult.error.message}`);
  }
  if (mortgageResult.error) {
    throw new Error(`Failed to delete mortgage liabilities: ${mortgageResult.error.message}`);
  }
  if (studentResult.error) {
    throw new Error(`Failed to delete student liabilities: ${studentResult.error.message}`);
  }
}
