/**
 * Environment configuration and constants
 */

import dotenv from "dotenv";
import {
  getSupabasePublishableKey,
  getSupabaseUrl,
} from "../storage/supabase.js";

dotenv.config();

const DEFAULT_BASE_URL = process.env.BASE_URL || "http://localhost:3000";

function parseNumberEnv(value: string | undefined, fallback: number): number {
  if (typeof value === "undefined") {
    return fallback;
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }

  return fallback;
}

export const CONFIG = {
  baseUrl: DEFAULT_BASE_URL,
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

  mcpAuth: {
    templateName: process.env.MCP_BEARER_TEMPLATE_NAME || "",
    audience: process.env.MCP_BEARER_AUDIENCE || `${DEFAULT_BASE_URL}/mcp`,
    resourceUrl: process.env.MCP_BEARER_RESOURCE_URL || `${DEFAULT_BASE_URL}/mcp`,
    realm: process.env.MCP_BEARER_REALM || "mcp",
    cacheTtlMs: parseNumberEnv(process.env.MCP_BEARER_CACHE_TTL_MS, 60_000),
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
