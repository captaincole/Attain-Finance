import { DemoInvestmentSeedData } from "../storage/demo/investments.js";

function sanitizeUserId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "-");
}

export const DEMO_SECURITY_IDS = {
  cashUsd: "demo_security_cash_usd",
  nvda: "demo_security_equity_nvda",
  tsla: "demo_security_equity_tsla",
  goog: "demo_security_equity_goog",
  voo: "demo_security_etf_voo",
  schd: "demo_security_etf_schd",
  ko: "demo_security_equity_ko",
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
      balances_current: 112500.0,
      balances_available: 8000.0,
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
      security_id: DEMO_SECURITY_IDS.nvda,
      name: "NVIDIA Corporation",
      ticker_symbol: "NVDA",
      type: "equity",
      subtype: "common stock",
      currency_code: "USD",
      close_price: 140.0,
      close_price_as_of: asOfDate,
      is_cash_equivalent: false,
    },
    {
      security_id: DEMO_SECURITY_IDS.tsla,
      name: "Tesla Inc",
      ticker_symbol: "TSLA",
      type: "equity",
      subtype: "common stock",
      currency_code: "USD",
      close_price: 250.0,
      close_price_as_of: asOfDate,
      is_cash_equivalent: false,
    },
    {
      security_id: DEMO_SECURITY_IDS.goog,
      name: "Alphabet Inc. Class C",
      ticker_symbol: "GOOG",
      type: "equity",
      subtype: "common stock",
      currency_code: "USD",
      close_price: 170.0,
      close_price_as_of: asOfDate,
      is_cash_equivalent: false,
    },
    {
      security_id: DEMO_SECURITY_IDS.voo,
      name: "Vanguard S&P 500 ETF",
      ticker_symbol: "VOO",
      type: "etf",
      subtype: "etf",
      currency_code: "USD",
      close_price: 500.0,
      close_price_as_of: asOfDate,
      is_cash_equivalent: false,
    },
    {
      security_id: DEMO_SECURITY_IDS.schd,
      name: "Schwab US Dividend Equity ETF",
      ticker_symbol: "SCHD",
      type: "etf",
      subtype: "etf",
      currency_code: "USD",
      close_price: 30.0,
      close_price_as_of: asOfDate,
      is_cash_equivalent: false,
    },
    {
      security_id: DEMO_SECURITY_IDS.ko,
      name: "The Coca-Cola Company",
      ticker_symbol: "KO",
      type: "equity",
      subtype: "common stock",
      currency_code: "USD",
      close_price: 60.0,
      close_price_as_of: asOfDate,
      is_cash_equivalent: false,
    },
  ];

  const holdings: DemoInvestmentSeedData["holdings"] = [
    {
      user_id: userId,
      account_id: accountId,
      security_id: DEMO_SECURITY_IDS.cashUsd,
      quantity: 8000,
      cost_basis: 8000,
      institution_price: 1,
      institution_price_as_of: asOfDate,
      institution_value: 8000,
      currency_code: "USD",
    },
    {
      user_id: userId,
      account_id: accountId,
      security_id: DEMO_SECURITY_IDS.nvda,
      quantity: 120,
      cost_basis: 14400,
      institution_price: 140.0,
      institution_price_as_of: asOfDate,
      institution_value: 16800,
      currency_code: "USD",
    },
    {
      user_id: userId,
      account_id: accountId,
      security_id: DEMO_SECURITY_IDS.tsla,
      quantity: 90,
      cost_basis: 20000,
      institution_price: 250.0,
      institution_price_as_of: asOfDate,
      institution_value: 22500,
      currency_code: "USD",
    },
    {
      user_id: userId,
      account_id: accountId,
      security_id: DEMO_SECURITY_IDS.goog,
      quantity: 200,
      cost_basis: 30000,
      institution_price: 170.0,
      institution_price_as_of: asOfDate,
      institution_value: 34000,
      currency_code: "USD",
    },
    {
      user_id: userId,
      account_id: accountId,
      security_id: DEMO_SECURITY_IDS.voo,
      quantity: 45,
      cost_basis: 21000,
      institution_price: 500.0,
      institution_price_as_of: asOfDate,
      institution_value: 22500,
      currency_code: "USD",
    },
    {
      user_id: userId,
      account_id: accountId,
      security_id: DEMO_SECURITY_IDS.schd,
      quantity: 150,
      cost_basis: 4200,
      institution_price: 30.0,
      institution_price_as_of: asOfDate,
      institution_value: 4500,
      currency_code: "USD",
    },
    {
      user_id: userId,
      account_id: accountId,
      security_id: DEMO_SECURITY_IDS.ko,
      quantity: 70,
      cost_basis: 4000,
      institution_price: 60.0,
      institution_price_as_of: asOfDate,
      institution_value: 4200,
      currency_code: "USD",
    },
  ];

  return {
    accounts,
    securities,
    holdings,
  };
}
