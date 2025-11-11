/**
 * Environment configuration and constants
 */

import {
  getSupabasePublishableKey,
  getSupabaseUrl,
} from "../storage/supabase.js";

export const CONFIG = {
  baseUrl: process.env.BASE_URL || "http://localhost:3000",
  port: process.env.PORT || 3000,

  plaid: {
    clientId: process.env.PLAID_CLIENT_ID || "",
    secret: process.env.PLAID_SECRET || "",
    env: process.env.PLAID_ENV || "sandbox",
  },

  clerk: {
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY || "",
    secretKey: process.env.CLERK_SECRET_KEY || "",
  },

  supabase: {
    get url(): string {
      return getSupabaseUrl();
    },
    get publishableKey(): string {
      return getSupabasePublishableKey();
    },
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || "",
  },

  jwt: {
    secret: process.env.JWT_SECRET || "",
  },

  widgets: {
    financialSummary: {
      uri: "ui://widget/financial-summary.html",
      name: "Financial Summary Widget",
      description: "Net worth overview with assets, liabilities, and weekly trend",
    },
    accountStatus: {
      uri: "ui://widget/account-status.html",
      name: "Account Status Widget",
      description: "Connected institution list with balances and connection health",
    },
    budgetList: {
      uri: "ui://widget/budget-list.html",
      name: "Budget List Widget",
      description: "Interactive budget cards showing spending progress with color-coded status bars",
    }
  }
};

/**
 * Helper to get the base URL for generating download links
 */
export function getBaseUrl(): string {
  return CONFIG.baseUrl;
}
