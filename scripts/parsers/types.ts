/**
 * Shared types for CSV parsers
 */

/**
 * Standardized transaction format used internally
 */
export interface StandardTransaction {
  date: string; // YYYY-MM-DD format
  description: string;
  amount: number; // Negative for outflows, positive for inflows
  category?: string;
}

/**
 * Plaid custom user transaction format
 * See: https://plaid.com/docs/sandbox/custom-users/
 */
export interface PlaidTransaction {
  date_transacted: string; // YYYY-MM-DD
  date_posted: string; // YYYY-MM-DD (can be same as date_transacted)
  description: string; // Merchant/description
  amount: number; // Positive = outflow, Negative = inflow (Plaid convention)
  currency: string; // e.g., "USD"
}

/**
 * Plaid account configuration
 */
export interface PlaidAccount {
  type: "depository" | "credit" | "loan" | "investment" | "payroll";
  subtype: string; // checking, savings, credit card, paypal, etc.
  starting_balance?: number;
  transactions?: PlaidTransaction[];
}

/**
 * Plaid custom user configuration schema
 * Note: No longer uses "version" field in current schema
 */
export interface PlaidCustomUserConfig {
  seed?: string;
  override_accounts: PlaidAccount[];
}

/**
 * Parser interface - all parsers must implement this
 */
export interface CSVParser {
  parse(filePath: string): Promise<StandardTransaction[]>;
}
