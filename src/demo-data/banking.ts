import { DemoBankSeedData } from "../storage/demo/banking.js";

export interface DemoBankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  direction: "credit" | "debit";
  category: string;
}

function sanitizeUserId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function buildDemoBankSeedData(userId: string): DemoBankSeedData {
  const slug = sanitizeUserId(userId);
  const accountId = `demo_bank_checking_${slug}`;

  const recentActivity: DemoBankTransaction[] = [
    {
      id: `${accountId}_tx_1`,
      date: "2025-03-01",
      description: "Acme Corp Payroll",
      amount: 4800,
      direction: "credit",
      category: "income",
    },
    {
      id: `${accountId}_tx_2`,
      date: "2025-02-26",
      description: "Bank of America Credit Card Payment",
      amount: -1250,
      direction: "debit",
      category: "payments",
    },
    {
      id: `${accountId}_tx_3`,
      date: "2025-02-20",
      description: "Freelance Design Payout",
      amount: 850,
      direction: "credit",
      category: "income",
    },
    {
      id: `${accountId}_tx_4`,
      date: "2025-02-18",
      description: "Rent Transfer",
      amount: -2200,
      direction: "debit",
      category: "housing",
    },
    {
      id: `${accountId}_tx_5`,
      date: "2025-02-12",
      description: "Bank of America Credit Card Payment",
      amount: -975,
      direction: "debit",
      category: "payments",
    },
  ];

  return {
    account: {
      account_id: accountId,
      user_id: userId,
      institution_name: "Bank of America",
      name: "Bank of America Advantage Checking",
      mask: "4821",
      type: "depository",
      subtype: "checking",
      balances_current: 20075.42,
      currency_code: "USD",
      last_synced_at: new Date().toISOString(),
    },
    transactions: recentActivity.map((tx) => ({
      id: tx.id,
      user_id: userId,
      account_id: accountId,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      direction: tx.direction,
      category: tx.category,
    })),
  };
}
