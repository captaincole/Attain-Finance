/**
 * Environment configuration and constants
 */

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
    url: process.env.SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || "",
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY || "",
  },

  jwt: {
    secret: process.env.JWT_SECRET || "",
  },

  widgets: {
    connectedInstitutions: {
      uri: "ui://widget/connected-institutions.html",
      name: "Connected Institutions Widget",
      description: "Interactive cards showing connected financial institutions with account balances",
    },
    budgetList: {
      uri: "ui://widget/budget-list.html",
      name: "Budget List Widget",
      description: "Interactive budget cards showing spending progress with color-coded status bars",
    },
    spendingSummary: {
      uri: "ui://widget/spending-summary.html",
      name: "Spending Summary Widget",
      description: "Horizontal category bars summarizing recent credit card spending",
    },
  }
};

/**
 * Helper to get the base URL for generating download links
 */
export function getBaseUrl(): string {
  return CONFIG.baseUrl;
}
