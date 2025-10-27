import { DemoInvestmentSeedData } from "../storage/demo/investments.js";

function sanitizeUserId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export const DEMO_SECURITY_IDS = {
  cashUsd: "demo_security_cash_usd",
  goog: "demo_security_equity_goog",
} as const;

export function isDemoInvestmentUser(_userId: string): boolean {
  return true;
}

export function buildDemoInvestmentSeedData(userId: string): DemoInvestmentSeedData {
  const slug = sanitizeUserId(userId);
  const accountId = `demo_investment_account_${slug}`;
  const asOfDate = new Date().toISOString().slice(0, 10);

  const accounts: DemoInvestmentSeedData["accounts"] = [
    {
      account_id: accountId,
      user_id: userId,
      name: "Brokerage Account",
      mask: "4242",
      type: "investment",
      subtype: "brokerage",
      currency_code: "USD",
      balances_current: 112150.0,
      balances_available: 28000.0,
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
      quantity: 28000,
      cost_basis: 28000,
      institution_price: 1,
      institution_price_as_of: asOfDate,
      institution_value: 28000,
      currency_code: "USD",
    },
    {
      user_id: userId,
      account_id: accountId,
      security_id: DEMO_SECURITY_IDS.goog,
      quantity: 600,
      cost_basis: 72000,
      institution_price: 140.25,
      institution_price_as_of: asOfDate,
      institution_value: 84150,
      currency_code: "USD",
    },
  ];

  return {
    accounts,
    securities,
    holdings,
  };
}
