/**
 * Account Tool Handlers
 * MCP tool handlers for account connection management
 * Delegates business logic to account-service
 */

import { PlaidApi } from "plaid";
import {
  initiateAccountConnection,
  disconnectAccount,
  getUserConnections,
} from "../../services/account-service.js";
import { getAccountsByUserId } from "../../storage/repositories/accounts.js";
import {
  getRecentNetWorthSnapshots,
  type NetWorthSnapshot,
} from "../../storage/repositories/net-worth-snapshots.js";

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
    {
      id: "analyze-spending",
      label: "Analyze Spending",
      description: "Review recent purchases and spot trends",
      icon: "📊",
      kind: "prompt",
      prompt: "Analyze my recent spending and highlight anything unusual.",
      variant: "secondary",
      promptFallback: "Analyze my spending",
    },
    {
      id: "add-advisor",
      label: "Add an Advisor",
      description: "Invite a trusted pro to monitor progress",
      icon: "🧑‍💼",
      kind: "prompt",
      prompt: "Walk me through how to invite my financial advisor into this workspace.",
      variant: "secondary",
      promptFallback: "Help me add an advisor",
    },
  ];
}

/**
 * Connect Account Tool Handler
 * Initiates account connection flow via Plaid Link
 */
export async function connectAccountHandler(
  userId: string,
  baseUrl: string,
  plaidClient: PlaidApi
) {
  try {
    const { linkUrl } = await initiateAccountConnection(userId, baseUrl, plaidClient);
    const expiresAtIso = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    let structuredContent: Record<string, any> = {};
    try {
      const summaryResult = await getFinancialSummaryHandler(userId);
      structuredContent = summaryResult.structuredContent
        ? JSON.parse(JSON.stringify(summaryResult.structuredContent))
        : {};
    } catch (summaryError) {
      console.warn("[CONNECT-ACCOUNT] Unable to hydrate financial summary structured content:", summaryError);
      structuredContent = { view: "financial-summary" };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `
**Connect Your Account**

Click this link to securely connect your account:
${linkUrl}

**What happens next:**
1. You'll see a secure interface to select your financial institution
2. After connecting, the page will confirm success
3. Your account balances will be fetched and stored automatically
4. Return here and say: "Show me my account balances"

**Note:** This link expires in 30 minutes.
          `.trim(),
        },
      ],
      structuredContent: {
        ...structuredContent,
        connectAccountLink: {
          url: linkUrl,
          expiresAt: expiresAtIso,
          instructions:
            "Use this secure Plaid Link window to connect your institution. The link opens in a new tab and expires in 30 minutes.",
        },
      },
    };
  } catch (error: any) {
    console.error("[CONNECT-ACCOUNT] Error:", error);

    const errorDetails = error.response?.data
      ? JSON.stringify(error.response.data, null, 2)
      : error.message;

    return {
      content: [
        {
          type: "text" as const,
          text: `
❌ **Error Creating Account Connection**

Failed to generate connection link.

**Error Details:**
\`\`\`
${errorDetails}
\`\`\`

**Common Issues:**
- Invalid API credentials
- Service environment mismatch (sandbox vs production)
- Missing required configuration

Please check your environment variables and try again.
          `.trim(),
        },
      ],
    };
  }
}

/**
 * Get Account Balances Tool Handler
 * Shows current balances from database (fast, no API calls)
 */
type AccountDashboardData = {
  accounts: Awaited<ReturnType<typeof getAccountsByUserId>>;
  connections: Awaited<ReturnType<typeof getUserConnections>>;
  liabilityDetails: any[];
  snapshots: NetWorthSnapshot[];
};

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

function groupAccountsByInstitution(
  accounts: Awaited<ReturnType<typeof getAccountsByUserId>>,
  connections: Awaited<ReturnType<typeof getUserConnections>>
) {
  const connectionMap = new Map(connections.map((c) => [c.itemId, c]));

  const accountsByInstitution = accounts.reduce<Record<string, typeof accounts>>((acc, account) => {
    if (!acc[account.item_id]) {
      acc[account.item_id] = [];
    }
    acc[account.item_id].push(account);
    return acc;
  }, {});

  const institutions = Object.entries(accountsByInstitution).map(([itemId, institutionAccounts]) => {
    const connection = connectionMap.get(itemId);
    const mostRecentSync = institutionAccounts.reduce<Date | null>((latest, account) => {
      const syncDate = new Date(account.last_synced_at);
      return !latest || syncDate > latest ? syncDate : latest;
    }, null);

    const createdAt = institutionAccounts[0]?.created_at
      ? new Date(institutionAccounts[0].created_at)
      : null;

    return {
      itemId,
      institutionName: connection?.institutionName || "Unknown Institution",
      status: connection?.status || "unknown",
      errorMessage: connection?.errorMessage || undefined,
      error: connection?.errorMessage || undefined,
      environment: connection?.environment,
      connectedAt: connection?.connectedAt?.toISOString() || createdAt?.toISOString(),
      lastSyncedAt: mostRecentSync?.toISOString(),
      accounts: institutionAccounts.map((account) => ({
        accountId: account.account_id,
        name: account.name,
        type: account.type,
        subtype: account.subtype || undefined,
        balances: {
          current: account.current_balance !== null ? Number(account.current_balance) : undefined,
          available: account.available_balance !== null ? Number(account.available_balance) : undefined,
          limit: account.limit_amount !== null ? Number(account.limit_amount) : undefined,
        },
      })),
    };
  });

  return { institutions, connectionMap, accountsByInstitution };
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

function buildAccountSections(
  accounts: Awaited<ReturnType<typeof getAccountsByUserId>>,
  assets: number,
  liabilities: number
) {
  return [
    {
      id: "assets",
      label: "Assets",
      total: assets,
      accountTypes: Array.from(
        new Set(
          accounts
            .filter((account) => !LIABILITY_ACCOUNT_TYPES.has(account.type))
            .map((account) => account.type)
        )
      ),
    },
    {
      id: "liabilities",
      label: "Liabilities",
      total: liabilities,
      accountTypes: Array.from(
        new Set(
          accounts
            .filter((account) => LIABILITY_ACCOUNT_TYPES.has(account.type))
            .map((account) => account.type)
        )
      ),
    },
  ];
}

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

export async function getAccountStatusHandler(userId: string) {
  const { accounts, connections, liabilityDetails } = await loadAccountDashboardData(userId);

  if (accounts.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `
🔗 **Account Status**

No institutions connected yet.

Say "Connect my account" to launch a secure Plaid Link window.
        `.trim(),
        },
      ],
      structuredContent: {
        view: "account-status",
        institutions: [],
        totalAccounts: 0,
        summary: {
          totalAccounts: 0,
          accountsByType: {},
          netWorth: 0,
          assetsTotal: 0,
          liabilitiesTotal: 0,
          lastSynced: null,
          liabilities: summarizeLiabilities(liabilityDetails),
        },
        dashboard: {
          accounts: {
            sections: [],
            nextSteps: buildNextSteps(),
          },
        },
      },
    };
  }

  const { institutions, connectionMap, accountsByInstitution } = groupAccountsByInstitution(accounts, connections);
  const accountsByType = summarizeAccountsByType(accounts);
  const { assets, liabilities, netWorth } = calculateNetTotals(accounts);
  const lastSyncedAt = getMostRecentSync(accounts);
  const liabilitySummary = summarizeLiabilities(liabilityDetails);
  const accountNextSteps = buildNextSteps();

  const responseLines: string[] = [];
  responseLines.push("🔗 **Account Status**");
  responseLines.push("");
  responseLines.push(
    `Connected Institutions (${accounts.length} account${accounts.length === 1 ? "" : "s"})`
  );

  Object.entries(accountsByInstitution).forEach(([itemId, institutionAccounts]) => {
    const connection = connectionMap.get(itemId);
    const institutionName = connection?.institutionName || "Unknown Institution";
    const status = connection?.status || "unknown";
    const statusEmoji = status === "active" ? "✓" : status === "error" ? "⚠️" : "•";
    const statusText = status === "active" ? "" : ` (${status})`;
    responseLines.push(`${statusEmoji} **${institutionName}**${statusText}`);
    responseLines.push(`Item ID: ${itemId}`);
    if (status === "error" && connection?.errorMessage) {
      responseLines.push(`⚠️ Error: ${connection.errorMessage}`);
      responseLines.push(`To fix: say "Update account link for ${itemId}"`);
    } else {
      institutionAccounts.forEach((account) => {
        const balanceText =
          account.current_balance !== null ? formatCurrency(Number(account.current_balance)) : "N/A";
        const availableText =
          account.available_balance !== null
            ? ` (Available: ${formatCurrency(Number(account.available_balance))})`
            : "";
        responseLines.push(
          `  • ${account.name}${account.subtype ? ` (${account.subtype})` : ""}: ${balanceText}${availableText}`
        );
        if (account.limit_amount !== null) {
          responseLines.push(`    Credit Limit: ${formatCurrency(Number(account.limit_amount))}`);
        }
      });
    }
    responseLines.push("");
  });

  responseLines.push("Summary by account type:");
  Object.entries(accountsByType).forEach(([type, data]) => {
    responseLines.push(
      `  ${type.charAt(0).toUpperCase() + type.slice(1)}: ${formatCurrency(data.total)}`
    );
  });
  responseLines.push(
    `Totals → Assets ${formatCurrency(assets)} • Liabilities ${formatCurrency(liabilities)} • Net Worth ${formatCurrency(netWorth)}`
  );
  responseLines.push("");
  responseLines.push("**Next Steps:**");
  accountNextSteps.forEach((step) => {
    responseLines.push(`  • ${step.label} — say "${step.promptFallback}"`);
  });

  return {
    content: [
      {
        type: "text" as const,
        text: responseLines.join("\n").trim(),
      },
    ],
    structuredContent: {
      view: "account-status",
      institutions,
      totalAccounts: accounts.length,
      accounts,
      summary: {
        totalAccounts: accounts.length,
        accountsByType,
        netWorth,
        assetsTotal: assets,
        liabilitiesTotal: liabilities,
        lastSynced: lastSyncedAt?.toISOString() || null,
        liabilities: liabilitySummary,
      },
      dashboard: {
        accounts: {
          sections: buildAccountSections(accounts, assets, liabilities),
          nextSteps: accountNextSteps,
        },
      },
    },
  };
}

/**
 * Disconnect Account Tool Handler
 * Removes a connection and invalidates the access token
 */
export async function disconnectAccountHandler(
  userId: string,
  itemId: string,
  plaidClient: PlaidApi
) {
  const connections = await getUserConnections(userId);

  if (connections.length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `
❌ **No Accounts Connected**

You don't have any connected accounts to disconnect.
          `.trim(),
        },
      ],
    };
  }

  const connection = connections.find((c) => c.itemId === itemId);

  if (!connection) {
    let responseText = `❌ **Account Not Found**\n\nItem ID "${itemId}" not found in your connections.\n\n`;
    responseText += `**Your Connected Accounts:**\n`;
    connections.forEach((conn, index) => {
      responseText += `${index + 1}. ${conn.itemId} (connected ${conn.connectedAt.toLocaleDateString()})\n`;
    });
    responseText += `\nTo disconnect, use one of the Item IDs listed above.`;

    return {
      content: [
        {
          type: "text" as const,
          text: responseText.trim(),
        },
      ],
    };
  }

  try {
    await disconnectAccount(userId, itemId, plaidClient);

    return {
      content: [
        {
          type: "text" as const,
          text: `
✓ **Account Disconnected**

Successfully disconnected and invalidated access token for:
**Item ID:** ${itemId}

Your financial data from this account has been removed.

**What's next:**
- Check remaining connections: "Show my account balances"
- Connect another account: "Connect my account"
          `.trim(),
        },
      ],
    };
  } catch (error: any) {
    console.error("[DISCONNECT-ACCOUNT] Error:", error);

    return {
      content: [
        {
          type: "text" as const,
          text: `
❌ **Disconnect Failed**

Failed to disconnect account: ${error.message}

Please try again or contact support if this issue persists.
          `.trim(),
        },
      ],
    };
  }
}
