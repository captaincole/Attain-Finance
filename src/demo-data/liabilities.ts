import { DemoLiabilitySeedData } from "../storage/demo/liabilities.js";

function sanitizeUserId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export const DEMO_LIABILITY_ACCOUNT_IDS = {
  mortgage: "demo_liability_mortgage",
  studentLoan: "demo_liability_student",
} as const;

export function buildDemoLiabilitySeedData(userId: string): DemoLiabilitySeedData {
  const slug = sanitizeUserId(userId);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const mortgageAccountId = `${DEMO_LIABILITY_ACCOUNT_IDS.mortgage}_${slug}`;
  const studentAccountId = `${DEMO_LIABILITY_ACCOUNT_IDS.studentLoan}_${slug}`;

  const accounts: DemoLiabilitySeedData["accounts"] = [
    {
      account_id: mortgageAccountId,
      user_id: userId,
      name: "Demo Mortgage",
      mask: "8842",
      type: "loan",
      subtype: "mortgage",
      balances_current: 700000,
      balances_available: null,
      limit_amount: null,
      currency_code: "USD",
      last_synced_at: now.toISOString(),
    },
    {
      account_id: studentAccountId,
      user_id: userId,
      name: "Demo Student Loan",
      mask: "3198",
      type: "loan",
      subtype: "student",
      balances_current: 50000,
      balances_available: null,
      limit_amount: null,
      currency_code: "USD",
      last_synced_at: now.toISOString(),
    },
  ];

  const details: DemoLiabilitySeedData["details"] = [
    {
      user_id: userId,
      account_id: mortgageAccountId,
      liability_type: "mortgage",
      interest_rate: 4.125,
      interest_rate_type: "fixed",
      minimum_payment_amount: 3850,
      next_payment_due_date: new Date(now.getFullYear(), now.getMonth(), 15).toISOString().slice(0, 10),
      last_payment_amount: 3850,
      last_payment_date: new Date(now.getFullYear(), now.getMonth() - 1, 15).toISOString().slice(0, 10),
      payoff_date: new Date(now.getFullYear() + 25, now.getMonth(), 1).toISOString().slice(0, 10),
      original_principal_amount: 820000,
      outstanding_principal_amount: 700000,
      escrow_balance: 8200,
      past_due_amount: 0,
      term_description: "30 year fixed",
      lender_name: "Demo Home Lending",
      details: {
        property_address: {
          street: "123 Demo Lane",
          city: "Austin",
          region: "TX",
          postal_code: "78701",
          country: "US",
        },
        has_pmi: false,
        has_prepayment_penalty: false,
        ytd_interest_paid: 14250,
        ytd_principal_paid: 11800,
      },
    },
    {
      user_id: userId,
      account_id: studentAccountId,
      liability_type: "student",
      interest_rate: 5.5,
      interest_rate_type: "fixed",
      minimum_payment_amount: 420,
      next_payment_due_date: new Date(now.getFullYear(), now.getMonth(), 25).toISOString().slice(0, 10),
      last_payment_amount: 420,
      last_payment_date: new Date(now.getFullYear(), now.getMonth() - 1, 25).toISOString().slice(0, 10),
      payoff_date: new Date(now.getFullYear() + 12, now.getMonth(), 1).toISOString().slice(0, 10),
      original_principal_amount: 68000,
      outstanding_principal_amount: 50000,
      escrow_balance: null,
      past_due_amount: 0,
      term_description: "Income-driven repayment",
      lender_name: "Demo Student Loan Servicing",
      details: {
        repayment_plan: {
          type: "income_driven",
          description: "Income-driven repayment (REPAYE)",
        },
        pslf_status: {
          estimated_eligibility_date: new Date(now.getFullYear() + 6, now.getMonth(), 1).toISOString().slice(0, 10),
          payments_made: 54,
          payments_remaining: 66,
        },
        disbursement_dates: ["2014-09-01"],
        outstanding_interest_amount: 2150,
      },
    },
  ];

  const creditScore: DemoLiabilitySeedData["creditScore"] = {
    user_id: userId,
    score: 720,
    score_date: today,
    provider: "VantageScore",
  };

  return {
    accounts,
    details,
    creditScore,
  };
}
