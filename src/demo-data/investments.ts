import { DemoInvestmentSeedData } from "../storage/demo/investments.js";

function sanitizeUserId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export const DEMO_SECURITY_IDS = {
  cashUsd: "demo_security_cash_usd",
  goog: "demo_security_equity_goog",
} as const;

export function buildDemoInvestmentSeedData(userId: string): DemoInvestmentSeedData {
  const slug = sanitizeUserId(userId);
  const accountId = `demo_investment_account_${slug}`;
  const asOfDate = new Date().toISOString().slice(0, 10);

  const accounts: DemoInvestmentSeedData["accounts"] = [
    {
      account_id: accountId,
      user_id: userId,
      name: "Demo Brokerage Account",
      mask: "4242",
      type: "investment",
      subtype: "brokerage",
      currency_code: "USD",
      balances_current: 21830.0,
      balances_available: 5000.0,
      last_synced_at: new Date().toISOString(),
    },
  ];

  const securities: DemoInvestmentSeedData["securities"] = [
    {
      security_id: DEMO_SECURITY_IDS.cashUsd,
      name: "U S Dollar",
      ticker_symbol: "USD",
      type: "cash",
      subtype: "cash",
      currency_code: "USD",
      close_price: 1,
      close_price_as_of: asOfDate,
      is_cash_equivalent: true,
    },
    {
      security_id: DEMO_SECURITY_IDS.goog,
      name: "Alphabet Inc. Class C",
      ticker_symbol: "GOOG",
      type: "equity",
      subtype: "common stock",
      currency_code: "USD",
      close_price: 140.25,
      close_price_as_of: asOfDate,
      is_cash_equivalent: false,
    },
  ];

  const holdings: DemoInvestmentSeedData["holdings"] = [
    {
      user_id: userId,
      account_id: accountId,
      security_id: DEMO_SECURITY_IDS.cashUsd,
      quantity: 5000,
      cost_basis: 5000,
      institution_price: 1,
      institution_price_as_of: asOfDate,
      institution_value: 5000,
      currency_code: "USD",
    },
    {
      user_id: userId,
      account_id: accountId,
      security_id: DEMO_SECURITY_IDS.goog,
      quantity: 120,
      cost_basis: 10000,
      institution_price: 140.25,
      institution_price_as_of: asOfDate,
      institution_value: 16830,
      currency_code: "USD",
    },
  ];

  return {
    accounts,
    securities,
    holdings,
  };
}
