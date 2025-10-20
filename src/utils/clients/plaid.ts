/**
 * Plaid Client Factory
 * Creates configured Plaid API client based on environment
 */

import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

/**
 * Create Plaid client instance
 * Reads configuration from environment variables
 */
export function createPlaidClient(): PlaidApi {
  const plaidConfiguration = new Configuration({
    basePath:
      process.env.PLAID_ENV === "production"
        ? PlaidEnvironments.production
        : process.env.PLAID_ENV === "development"
        ? PlaidEnvironments.development
        : PlaidEnvironments.sandbox,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID || "",
        "PLAID-SECRET": process.env.PLAID_SECRET || "",
      },
    },
  });

  return new PlaidApi(plaidConfiguration);
}
