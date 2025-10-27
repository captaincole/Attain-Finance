import { DemoLiabilitySeedData } from "../storage/demo/liabilities.js";

function sanitizeUserId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export const DEMO_LIABILITY_ACCOUNT_IDS = {
  autoLoan: "demo_liability_auto",
  studentLoan: "demo_liability_student",
} as const;

export function buildDemoLiabilitySeedData(userId: string): DemoLiabilitySeedData {
  const slug = sanitizeUserId(userId);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const autoLoanAccountId = `${DEMO_LIABILITY_ACCOUNT_IDS.autoLoan}_${slug}`;
  const studentAccountId = `${DEMO_LIABILITY_ACCOUNT_IDS.studentLoan}_${slug}`;

  const accounts: DemoLiabilitySeedData["accounts"] = [
    {
      account_id: autoLoanAccountId,
      user_id: userId,
      name: "Auto Loan",
      mask: "2741",
      type: "loan",
      subtype: "auto",
      balances_current: 38500,
      balances_available: null,
      limit_amount: null,
      currency_code: "USD",
      last_synced_at: now.toISOString(),
    },
    {
      account_id: studentAccountId,
      user_id: userId,
      name: "Student Loan",
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
      account_id: autoLoanAccountId,
      liability_type: "auto",
      interest_rate: 5.49,
      interest_rate_type: "fixed",
      minimum_payment_amount: 648,
      next_payment_due_date: new Date(now.getFullYear(), now.getMonth(), 18).toISOString().slice(0, 10),
      last_payment_amount: 648,
      last_payment_date: new Date(now.getFullYear(), now.getMonth() - 1, 18).toISOString().slice(0, 10),
      payoff_date: new Date(now.getFullYear() + 4, now.getMonth(), 1).toISOString().slice(0, 10),
      original_principal_amount: 52000,
      outstanding_principal_amount: 38500,
      escrow_balance: null,
      past_due_amount: 0,
      term_description: "60-month auto loan",
      lender_name: "Auto Finance",
      details: {
        vehicle: {
          make: "Tesla",
          model: "Model Y Long Range",
          year: 2023,
          vin_last4: "28F1",
        },
        has_prepayment_penalty: false,
        ytd_interest_paid: 1450,
        ytd_principal_paid: 8200,
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
