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

function daysAgo(days: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function buildDemoBankSeedData(userId: string): DemoBankSeedData {
  const slug = sanitizeUserId(userId);
  const accountId = `demo_bank_checking_${slug}`;

  const recentActivity: DemoBankTransaction[] = [
    {
      id: `${accountId}_tx_payroll_primary`,
      date: formatDate(daysAgo(3)),
      description: "Acme Corp Payroll",
      amount: 10400,
      direction: "credit",
      category: "income",
    },
    {
      id: `${accountId}_tx_credit_card_payment_recent`,
      date: formatDate(daysAgo(6)),
      description: "Chase Sapphire Payment",
      amount: -1850,
      direction: "debit",
      category: "payments",
    },
    {
      id: `${accountId}_tx_rent`,
      date: formatDate(daysAgo(20)),
      description: "Rent Transfer - Downtown Loft",
      amount: -3200,
      direction: "debit",
      category: "housing",
    },
    {
      id: `${accountId}_tx_invest`,
      date: formatDate(daysAgo(24)),
      description: "Attain Smart Cash Sweep",
      amount: -1250,
      direction: "debit",
      category: "investing",
    },
    {
      id: `${accountId}_tx_groceries`,
      date: formatDate(daysAgo(9)),
      description: "Whole Foods Market",
      amount: -420.57,
      direction: "debit",
      category: "groceries",
    },
    {
      id: `${accountId}_tx_utilities`,
      date: formatDate(daysAgo(12)),
      description: "Austin Energy Utility Bill",
      amount: -198.44,
      direction: "debit",
      category: "utilities",
    },
    {
      id: `${accountId}_tx_entertainment`,
      date: formatDate(daysAgo(5)),
      description: "Paramount Theatre Tickets",
      amount: -86.25,
      direction: "debit",
      category: "entertainment",
    },
  ];

  const currentBalance = 24580.16;

  return {
    account: {
      account_id: accountId,
      user_id: userId,
      institution_name: "Bank of America",
      name: "Bank of America Advantage Checking",
      mask: "4821",
      type: "depository",
      subtype: "checking",
      balances_current: currentBalance,
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
