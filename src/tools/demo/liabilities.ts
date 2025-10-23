import type { ToolDefinition } from "../types.js";
import { getDemoLiabilitySnapshot } from "../../storage/demo/liabilities.js";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date?: string | null): string {
  if (!date) {
    return "N/A";
  }
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString();
}

export function getDebtOverviewTool(): ToolDefinition {
  return {
    name: "get-debt-overview",
    description:
      "Summarize mortgage and student loan liabilities for the demo user, including balances, APRs, payoff timelines, and minimum payments.",
    inputSchema: {},
    options: {
      readOnlyHint: true,
      securitySchemes: [{ type: "oauth2" }],
    },
    handler: async (_args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;

      if (!userId) {
        throw new Error("User authentication required");
      }

      const snapshot = await getDemoLiabilitySnapshot(userId);

      if (snapshot.details.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No liability data found. Run the demo liability seed script to populate mortgage and student loan examples.",
            },
          ],
          structuredContent: {
            accounts: [],
            details: [],
            totals: snapshot.totals,
            creditScore: snapshot.creditScore,
          },
        };
      }

      const accountMap = new Map(
        snapshot.accounts.map((account) => [account.account_id, account])
      );

      let text = `**Demo Debt Overview**\n\n`;
      text += `Total balance across debts: ${formatCurrency(
        snapshot.totals.totalBalance
      )}\n`;
      text += `Minimum payments due this month: ${formatCurrency(
        snapshot.totals.totalMinimumPayment
      )}\n`;
      if (snapshot.totals.totalPastDue > 0) {
        text += `Past due amount: ${formatCurrency(
          snapshot.totals.totalPastDue
        )}\n`;
      }
      text += "\n";

      snapshot.details.forEach((detail) => {
        const account = accountMap.get(detail.account_id);
        const balance =
          detail.outstanding_principal_amount ??
          account?.balances_current ??
          0;

        text += `**${account?.name || detail.liability_type}**\n`;
        text += `• Balance: ${formatCurrency(balance)}\n`;
        if (detail.interest_rate) {
          text += `• Interest rate: ${detail.interest_rate.toFixed(3)}%`;
          if (detail.interest_rate_type) {
            text += ` (${detail.interest_rate_type})`;
          }
          text += "\n";
        }
        if (detail.minimum_payment_amount) {
          text += `• Minimum payment: ${formatCurrency(
            detail.minimum_payment_amount
          )}\n`;
        }
        if (detail.next_payment_due_date) {
          text += `• Next payment due: ${formatDate(
            detail.next_payment_due_date
          )}\n`;
        }
        if (detail.payoff_date) {
          text += `• Expected payoff: ${formatDate(detail.payoff_date)}\n`;
        }
        text += "\n";
      });

      return {
        content: [
          {
            type: "text" as const,
            text: text.trim(),
          },
        ],
        structuredContent: {
          accounts: snapshot.accounts,
          details: snapshot.details,
          totals: snapshot.totals,
          creditScore: snapshot.creditScore,
          debtsByType: snapshot.debtsByType,
        },
      };
    },
  };
}

export function getCreditScoreTool(): ToolDefinition {
  return {
    name: "get-credit-score",
    description:
      "Fetch the demo user's credit score snapshot for use in financial conversations.",
    inputSchema: {},
    options: {
      readOnlyHint: true,
      securitySchemes: [{ type: "oauth2" }],
    },
    handler: async (_args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;

      if (!userId) {
        throw new Error("User authentication required");
      }

      const snapshot = await getDemoLiabilitySnapshot(userId);
      const creditScore = snapshot.creditScore;

      if (!creditScore) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No credit score is available for the demo user. Seed liabilities data to generate a score.",
            },
          ],
          structuredContent: {},
        };
      }

      const text = `**Credit Score Snapshot**\n\nScore: ${
        creditScore.score
      }\nProvider: ${creditScore.provider || "Unknown"}\nAs of: ${formatDate(
        creditScore.score_date
      )}`;

      return {
        content: [
          {
            type: "text" as const,
            text,
          },
        ],
        structuredContent: {
          creditScore,
        },
      };
    },
  };
}
