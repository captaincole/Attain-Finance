import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  formatCurrency,
  formatRelativeTime,
  getInitialPendingActionId,
  getOpenAIBridge,
  normalizeNextSteps,
  persistPendingActionId,
  useToolOutput,
  type NextStepAction,
} from "./shared/widget-utils.js";

interface Account {
  accountId?: string;
  name: string;
  type: string;
  subtype?: string;
  balances: {
    current?: number;
  };
  institutionName?: string;
}

interface Institution {
  itemId: string;
  institutionName: string;
  lastSyncedAt?: string;
  status?: string;
  errorMessage?: string;
  accounts: Account[];
}

interface AccountStatusOutput {
  institutions?: Institution[];
  totalAccounts?: number;
  summary?: {
    totalAccounts?: number;
    lastSynced?: string | null;
  };
  dashboard?: {
    accounts?: {
      nextSteps?: NextStepAction[];
    };
  };
}

function getAccountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    credit: "Credit Cards",
    depository: "Bank Accounts",
    investment: "Investments",
    loan: "Loans",
    other: "Other Accounts",
  };
  return labels[type] || "Other Accounts";
}

function groupAccountsByType(institutions: Institution[]): Map<string, Account[]> {
  const grouped = new Map<string, Account[]>();
  institutions.forEach((institution) => {
    institution.accounts.forEach((account) => {
      if (!grouped.has(account.type)) {
        grouped.set(account.type, []);
      }
      grouped.get(account.type)!.push({
        ...account,
        institutionName: institution.institutionName,
      });
    });
  });
  return grouped;
}

function AccountStatusWidget() {
  const toolOutput = useToolOutput<AccountStatusOutput>();
  const [pendingActionId, setPendingActionId] = useState<string | null>(getInitialPendingActionId());

  if (toolOutput === null) {
    return (
      <div className="institutions-widget">
        <div className="loading-state" style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const institutions = toolOutput.institutions ?? [];
  const accountsByType = groupAccountsByType(institutions);
  const totalAccounts =
    toolOutput.totalAccounts ??
    toolOutput.summary?.totalAccounts ??
    institutions.reduce((sum, institution) => sum + institution.accounts.length, 0);

  const lastSynced = toolOutput.summary?.lastSynced
    ? new Date(toolOutput.summary.lastSynced)
    : institutions
        .map((inst) => (inst.lastSyncedAt ? new Date(inst.lastSyncedAt) : null))
        .filter((date): date is Date => Boolean(date))
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  const accountNextSteps = normalizeNextSteps(toolOutput.dashboard?.accounts?.nextSteps);

  const errorInstitutions = institutions.filter(
    (inst) => (inst.status === "error" || inst.errorMessage) && inst.errorMessage
  );

  async function handleNextStepClick(step: NextStepAction) {
    if (pendingActionId) return;
    setPendingActionId(step.id);
    await persistPendingActionId(step.id);

    try {
      const openaiBridge = getOpenAIBridge();
      if (step.kind === "tool" && step.tool && openaiBridge?.callTool) {
        await openaiBridge.callTool(step.tool, step.toolArgs ?? {});
      } else if (step.kind === "prompt" && step.prompt && openaiBridge?.sendFollowupTurn) {
        await openaiBridge.sendFollowupTurn({ prompt: step.prompt });
      }
    } finally {
      setPendingActionId(null);
      await persistPendingActionId(null);
    }
  }

  function renderNextSteps(steps: NextStepAction[]) {
    if (!steps.length) return null;
    return (
      <div className="next-steps-row next-steps-accounts">
        <div className="next-steps-grid">
          {steps.map((step) => (
            <button
              key={`accounts-${step.id}`}
              className={`next-step-pill ${step.variant ?? "secondary"}${
                pendingActionId === step.id ? " loading" : ""
              }`}
              onClick={() => handleNextStepClick(step)}
              disabled={!!pendingActionId}
            >
              <span>{step.label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="institutions-widget">
      <section className="accounts-card">
        <div className="section-header">
          <div className="tool-badge muted">Account Status</div>
          <div>
            <h3>Accounts</h3>
            <span>{totalAccounts} connected</span>
          </div>
          {lastSynced && <span className="updated-pill">Updated {formatRelativeTime(lastSynced)}</span>}
        </div>

        {totalAccounts > 0 ? (
          <div className="accounts-by-type">
            {Array.from(accountsByType).map(([accountType, accounts], idx) => (
              <div key={accountType} className="account-type-block">
                {idx > 0 && <div className="divider" />}
                <div className="account-type-label">{getAccountTypeLabel(accountType)}</div>
                <table className="account-type-table">
                  <tbody>
                    {accounts.map((account, index) => (
                      <tr key={`${account.name}-${index}`}>
                        <td>
                          <div className="account-name">{account.name}</div>
                          <div className="account-meta">{account.institutionName}</div>
                        </td>
                        <td className="account-balance">
                          {account.balances.current !== undefined ? formatCurrency(account.balances.current) : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <p>No institutions connected</p>
            <p style={{ fontSize: "0.9rem", color: "#475569", marginTop: "0.5rem" }}>
              Use "Connect my account" to get started.
            </p>
          </div>
        )}

        {errorInstitutions.length > 0 && (
          <div className="connection-alert">
            <strong>Connections to fix</strong>
            <ul>
              {errorInstitutions.map((institution) => (
                <li key={institution.itemId}>
                  {institution.institutionName}: {institution.errorMessage}
                </li>
              ))}
            </ul>
          </div>
        )}

        {renderNextSteps(accountNextSteps)}
      </section>
    </div>
  );
}

const root = document.getElementById("account-status-root");
if (root) {
  createRoot(root).render(<AccountStatusWidget />);
}
