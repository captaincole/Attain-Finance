/**
 * Get Financial Summary Tool
 * Net worth and asset overview with trend analysis
 */

import { z } from "zod";
import { getAccountsByUserId } from "../../storage/repositories/accounts.js";
import { getUserConnections } from "../../services/account-service.js";
import {
  getRecentNetWorthSnapshots,
  type NetWorthSnapshot,
} from "../../storage/repositories/net-worth-snapshots.js";

// Output schema for financial-summary tool (using Zod for type safety and validation)
// This defines the structure of the tool's response, including both human-readable content
// and machine-readable structuredContent fields
// Note: This tool has no input parameters
export const GetFinancialSummaryOutputSchema = {
  structuredContent: z.object({
    view: z.literal("financial-summary").describe("View type identifier"),
    accounts: z.array(z.any()).optional().describe("Array of account details"),
    summary: z.object({
      totalAccounts: z.number().describe("Total number of connected accounts"),
      accountsByType: z.record(z.object({
        accounts: z.array(z.any()),
        total: z.number(),
      })).describe("Accounts grouped by type with totals"),
      netWorth: z.number().describe("Current net worth (assets - liabilities) in USD"),
      assetsTotal: z.number().describe("Total assets across all accounts in USD"),
      liabilitiesTotal: z.number().describe("Total liabilities across all accounts in USD"),
      lastSynced: z.string().nullable().describe("ISO timestamp of most recent account sync"),
      liabilities: z.object({
        total: z.number().describe("Total number of liabilities"),
        credit: z.number().describe("Number of credit card liabilities"),
        mortgage: z.number().describe("Number of mortgage liabilities"),
        student: z.number().describe("Number of student loan liabilities"),
      }).describe("Summary of liabilities by type"),
      netWorthTrend: z.object({
        amountChange: z.number().describe("Net worth change in USD since baseline date"),
        percentChange: z.number().nullable().describe("Net worth change as percentage. Null if baseline was zero"),
        direction: z.enum(["up", "down", "flat"]).describe("Trend direction"),
        baselineDate: z.string().describe("ISO date of comparison snapshot (typically 1 week ago)"),
      }).nullable().describe("Week-over-week net worth trend. Null if insufficient historical data"),
    }).optional().describe("Financial summary statistics"),
    dashboard: z.object({
      hero: z.object({
        netWorth: z.number().describe("Current net worth in USD"),
        assetsTotal: z.number().describe("Total assets in USD"),
        liabilitiesTotal: z.number().describe("Total liabilities in USD"),
        lastUpdatedAt: z.string().nullable().describe("ISO timestamp of last update"),
        trend: z.object({
          amountChange: z.number().describe("Net worth change in USD"),
          percentChange: z.number().nullable().describe("Net worth change as percentage"),
          direction: z.enum(["up", "down", "flat"]).describe("Trend direction"),
          label: z.string().describe("Human-readable label (e.g., 'since last week')"),
          baselineDate: z.string().describe("ISO date of comparison"),
        }).nullable().describe("Trend data. Null if no historical snapshots"),
        hasData: z.boolean().describe("Whether user has connected accounts"),
        nextSteps: z.array(z.object({
          id: z.string(),
          label: z.string(),
          description: z.string().optional(),
          icon: z.string(),
          kind: z.enum(["tool", "prompt"]),
          tool: z.string().optional(),
          toolArgs: z.record(z.unknown()).optional(),
          prompt: z.string().optional(),
          variant: z.enum(["primary", "secondary"]).optional(),
          promptFallback: z.string(),
        })).describe("Suggested next actions for the user"),
      }).describe("Hero section data for dashboard widget"),
    }).describe("Dashboard-specific structured data"),
  }).optional().describe("Structured financial summary data for programmatic use"),
};

const LIABILITY_ACCOUNT_TYPES = new Set(["credit", "loan"]);
const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type NextStepAction =
  | {
      id: string;
      label: string;
      description?: string;
      icon: string;
      kind: "tool";
      tool: string;
      toolArgs?: Record<string, unknown>;
      variant?: "primary" | "secondary";
      promptFallback: string;
    }
  | {
      id: string;
      label: string;
      description?: string;
      icon: string;
      kind: "prompt";
      prompt: string;
      variant?: "primary" | "secondary";
      promptFallback: string;
    };

type AccountDashboardData = {
  accounts: Awaited<ReturnType<typeof getAccountsByUserId>>;
  connections: Awaited<ReturnType<typeof getUserConnections>>;
  liabilityDetails: any[];
  snapshots: NetWorthSnapshot[];
};

function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

function calculateNetTotals(accounts: Awaited<ReturnType<typeof getAccountsByUserId>>) {
  const totals = accounts.reduce(
    (acc, account) => {
      const current = account.current_balance ?? 0;
      if (LIABILITY_ACCOUNT_TYPES.has(account.type)) {
        acc.liabilities += Math.abs(current);
      } else {
        acc.assets += current;
      }
      return acc;
    },
    { assets: 0, liabilities: 0 }
  );

  return {
    assets: totals.assets,
    liabilities: totals.liabilities,
    netWorth: totals.assets - totals.liabilities,
  };
}

function differenceInDays(a: Date, b: Date): number {
  const diffMs = a.getTime() - b.getTime();
  return diffMs / (1000 * 60 * 60 * 24);
}

function buildNetWorthTrend(
  currentNetWorth: number,
  snapshots: NetWorthSnapshot[]
):
  | {
      amountChange: number;
      percentChange: number | null;
      direction: "up" | "down" | "flat";
      baselineDate: string;
      label: string;
    }
  | null {
  if (snapshots.length === 0) {
    return null;
  }

  const now = new Date();
  const comparisonSnapshot = snapshots.find((snapshot) => {
    const snapshotDate = new Date(snapshot.snapshot_date);
    return differenceInDays(now, snapshotDate) >= 6;
  });

  if (!comparisonSnapshot) {
    return null;
  }

  const amountChange = currentNetWorth - Number(comparisonSnapshot.net_worth_amount);
  const direction: "up" | "down" | "flat" =
    amountChange > 0 ? "up" : amountChange < 0 ? "down" : "flat";

  let percentChange: number | null = null;
  if (Math.abs(Number(comparisonSnapshot.net_worth_amount)) >= 0.01) {
    percentChange = (amountChange / Math.abs(Number(comparisonSnapshot.net_worth_amount))) * 100;
  }

  return {
    amountChange,
    percentChange,
    direction,
    baselineDate: comparisonSnapshot.snapshot_date,
    label: "since last week",
  };
}

function buildNextSteps(): NextStepAction[] {
  return [
    {
      id: "connect-account",
      label: "Connect Account",
      description: "Bring in another bank, card, or investment account",
      icon: "🔗",
      kind: "tool",
      tool: "connect-account",
      toolArgs: {},
      variant: "primary",
      promptFallback: "Connect my account",
    },
  ];
}

async function loadAccountDashboardData(userId: string): Promise<AccountDashboardData> {
  const accounts = await getAccountsByUserId(userId);
  const { getLiabilitiesByUserId } = await import("../../storage/repositories/liabilities.js");

  const [connections, liabilityDetails, snapshots] = await Promise.all([
    getUserConnections(userId),
    getLiabilitiesByUserId(userId),
    getRecentNetWorthSnapshots(userId, { limit: 8 }),
  ]);

  return { accounts, connections, liabilityDetails, snapshots };
}

function getMostRecentSync(accounts: Awaited<ReturnType<typeof getAccountsByUserId>>): Date | null {
  return accounts.reduce<Date | null>((latest, account) => {
    const syncDate = new Date(account.last_synced_at);
    return !latest || syncDate > latest ? syncDate : latest;
  }, null);
}

function summarizeLiabilities(liabilityDetails: any[]) {
  return {
    total: liabilityDetails.length,
    credit: liabilityDetails.filter((l) => l.type === "credit").length,
    mortgage: liabilityDetails.filter((l) => l.type === "mortgage").length,
    student: liabilityDetails.filter((l) => l.type === "student").length,
  };
}

function summarizeAccountsByType(
  accounts: Awaited<ReturnType<typeof getAccountsByUserId>>
): Record<string, { accounts: typeof accounts; total: number }> {
  return accounts.reduce<Record<string, { accounts: typeof accounts; total: number }>>(
    (acc, account) => {
      if (!acc[account.type]) {
        acc[account.type] = { accounts: [], total: 0 };
      }
      acc[account.type].accounts.push(account);
      acc[account.type].total += Number(account.current_balance ?? 0);
      return acc;
    },
    {}
  );
}

/**
 * Handler for financial-summary tool
 */
export async function getFinancialSummaryHandler(userId: string) {
  const { accounts, liabilityDetails, snapshots } = await loadAccountDashboardData(userId);
  const hasAccounts = accounts.length > 0;

  if (!hasAccounts) {
    return {
      content: [
        {
          type: "text" as const,
          text: `
🏠 **Financial Summary**

No connected accounts yet.

Say "Connect my account" to link your first bank, card, or investment account.
          `.trim(),
        },
      ],
      structuredContent: {
        view: "financial-summary",
        dashboard: {
          hero: {
            netWorth: 0,
            assetsTotal: 0,
            liabilitiesTotal: 0,
            lastUpdatedAt: null,
            trend: null,
            hasData: false,
            nextSteps: buildNextSteps(),
          },
        },
      },
    };
  }

  const { assets, liabilities, netWorth } = calculateNetTotals(accounts);
  const netWorthTrend = buildNetWorthTrend(netWorth, snapshots);
  const lastSyncedAt = getMostRecentSync(accounts);
  const liabilitySummary = summarizeLiabilities(liabilityDetails);

  const heroNextSteps = buildNextSteps();
  const heroSection = {
    netWorth,
    assetsTotal: assets,
    liabilitiesTotal: liabilities,
    lastUpdatedAt: lastSyncedAt?.toISOString() || null,
    trend: netWorthTrend
      ? {
          amountChange: netWorthTrend.amountChange,
          percentChange: netWorthTrend.percentChange,
          direction: netWorthTrend.direction,
          label: netWorthTrend.label,
          baselineDate: netWorthTrend.baselineDate,
        }
      : null,
    hasData: true,
    nextSteps: heroNextSteps,
  };

  const responseLines: string[] = [];
  responseLines.push("🏠 **Financial Summary**");
  responseLines.push("");
  responseLines.push(`**Net Worth:** ${formatCurrency(netWorth)}`);
  if (netWorthTrend) {
    const percentText =
      netWorthTrend.percentChange !== null
        ? ` (${netWorthTrend.percentChange >= 0 ? "+" : ""}${netWorthTrend.percentChange.toFixed(2)}%)`
        : "";
    const trendSymbol = netWorthTrend.direction === "up" ? "📈" : netWorthTrend.direction === "down" ? "📉" : "➖";
    responseLines.push(
      `${trendSymbol} ${formatCurrency(netWorthTrend.amountChange)}${percentText} ${netWorthTrend.label}`
    );
  } else {
    responseLines.push("_Trend data appears after we collect a weekly snapshot._");
  }
  if (lastSyncedAt) {
    responseLines.push(`Last updated: ${lastSyncedAt.toLocaleString()}`);
    responseLines.push('*To refresh balances, say: "Refresh my transactions"*');
  }
  responseLines.push("");
  responseLines.push(`Assets: ${formatCurrency(assets)} • Liabilities: ${formatCurrency(liabilities)}`);

  if (liabilitySummary.total > 0) {
    const parts: string[] = [];
    if (liabilitySummary.credit > 0) {
      parts.push(`${liabilitySummary.credit} credit card${liabilitySummary.credit > 1 ? "s" : ""}`);
    }
    if (liabilitySummary.mortgage > 0) {
      parts.push(`${liabilitySummary.mortgage} mortgage${liabilitySummary.mortgage > 1 ? "s" : ""}`);
    }
    if (liabilitySummary.student > 0) {
      parts.push(`${liabilitySummary.student} student loan${liabilitySummary.student > 1 ? "s" : ""}`);
    }
    responseLines.push("");
    responseLines.push(
      `Liabilities detected: ${liabilitySummary.total}${parts.length ? ` (${parts.join(", ")})` : ""}`
    );
  }

  responseLines.push("");
  responseLines.push("**Suggested Next Steps:**");
  heroNextSteps.forEach((step) => {
    responseLines.push(`  • ${step.label} — say "${step.promptFallback}"`);
  });

  const accountsByType = summarizeAccountsByType(accounts);

  return {
    content: [
      {
        type: "text" as const,
        text: responseLines.join("\n").trim(),
      },
    ],
    structuredContent: {
      view: "financial-summary",
      accounts,
      summary: {
        totalAccounts: accounts.length,
        accountsByType,
        netWorth,
        assetsTotal: assets,
        liabilitiesTotal: liabilities,
        lastSynced: lastSyncedAt?.toISOString() || null,
        liabilities: liabilitySummary,
        netWorthTrend: netWorthTrend
          ? {
              amountChange: netWorthTrend.amountChange,
              percentChange: netWorthTrend.percentChange,
              direction: netWorthTrend.direction,
              baselineDate: netWorthTrend.baselineDate,
            }
          : null,
      },
      dashboard: {
        hero: heroSection,
      },
    },
  };
}
