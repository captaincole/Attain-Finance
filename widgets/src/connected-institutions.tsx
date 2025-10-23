import React, { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";

// Types matching our tool output
interface DemoTransactionMeta {
  amount: number;
  date: string;
  description: string;
}

interface Account {
  name: string;
  type: string;
  subtype?: string | null;
  balances: {
    current?: number;
  };
  liabilityMeta?: {
    minimumPaymentAmount?: number | null;
    nextPaymentDueDate?: string | null;
    payoffDate?: string | null;
    interestRate?: number | null;
  };
}

interface Institution {
  itemId: string;
  institutionName: string;
  status: string;
  environment: string;
  connectedAt?: string;
  groupType?: "demo-investments" | "demo-liabilities" | "demo-banking" | "plaid";
  totals?: Record<string, number> | null;
  meta?: {
    lastDeposit?: DemoTransactionMeta | null;
    recentPayment?: DemoTransactionMeta | null;
  } | null;
  accounts: Account[];
  errorMessage?: string;
}

interface SummaryData {
  totalAccounts?: number;
  demoInvestments?: {
    totalValue: number;
    totalCash: number;
    totalInvested: number;
  } | null;
  demoLiabilities?: {
    totalBalance: number;
    totalMinimumPayment: number;
    totalPastDue: number;
  } | null;
  demoBanking?: {
    availableBalance: number;
    inflow30Days: number;
    outflow30Days: number;
    lastDeposit?: DemoTransactionMeta | null;
    recentPayment?: DemoTransactionMeta | null;
  } | null;
}

interface ConnectedInstitutionsOutput {
  institutions: Institution[];
  totalAccounts: number;
  summary?: SummaryData;
}

function formatCurrency(value?: number | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value?: string | null): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString();
}

function titleCase(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  return value
    .split(/[_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "#f5f7fb",
        borderRadius: "0.5rem",
        padding: "0.45rem 0.75rem",
        fontSize: "0.78rem",
        display: "flex",
        flexDirection: "column",
        minWidth: "6.5rem",
        gap: "0.2rem",
      }}
    >
      <span style={{ color: "#5f6b7c", fontWeight: 500 }}>{label}</span>
      <span style={{ fontWeight: 600, color: "#1a1f36" }}>{value}</span>
    </div>
  );
}

// Hook to subscribe to window.openai.toolOutput changes
// Matches the pattern from OpenAI's official examples
function useToolOutput(): ConnectedInstitutionsOutput | null {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") {
        return () => {};
      }

      // ChatGPT fires "openai:set_globals" event when toolOutput changes
      const handleSetGlobals = (event: CustomEvent) => {
        if (event.detail?.globals?.toolOutput !== undefined) {
          onChange();
        }
      };

      window.addEventListener("openai:set_globals", handleSetGlobals as EventListener);
      return () => {
        window.removeEventListener("openai:set_globals", handleSetGlobals as EventListener);
      };
    },
    () => (window as any).openai?.toolOutput ?? null,
    () => null // Server-side rendering fallback
  );
}

function ConnectedInstitutionsWidget() {
  // Subscribe to toolOutput changes
  const toolOutput = useToolOutput();

  // DEBUG: Log everything
  console.log("=== Widget Render ===");
  console.log("toolOutput:", toolOutput);

  // While waiting for data, show a simple loading state
  // ChatGPT already shows "Loading your connected institutions..." via _meta
  if (toolOutput === null) {
    return (
      <div className="institutions-widget">
        <div className="loading-state" style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Extract data - toolOutput is guaranteed to exist here
  const institutions = toolOutput.institutions || [];
  const totalAccounts = toolOutput.totalAccounts || 0;

  return (
    <div className="institutions-widget">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #e0e0e0' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>Connected Accounts</h3>
        <div style={{ fontSize: '0.85rem', color: '#666' }}>{totalAccounts} total</div>
      </div>

      {institutions.length === 0 ? (
        <div className="empty-state">
          <p>No institutions connected</p>
          <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
            Use "Connect my bank account" to get started
          </p>
        </div>
      ) : (
        <div className="institutions-list">
          {institutions.map((institution, instIndex) => (
            <div key={institution.itemId}>
              {instIndex > 0 && <div style={{ height: '1px', background: '#e0e0e0', margin: '0.75rem 0' }} />}

              <div className="institution-section">
                {(() => {
                  const isDemoInvestments = institution.groupType === "demo-investments";
                  const isDemoLiabilities = institution.groupType === "demo-liabilities";
                  const environmentLabel = isDemoInvestments || isDemoLiabilities
                    ? "Demo"
                    : titleCase(institution.environment) || "Unknown";
                  const connectedLabel = institution.connectedAt
                    ? `Last synced ${formatDate(institution.connectedAt)}`
                    : undefined;
                  return (
                    <div
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        color: "#333",
                        marginBottom: "0.5rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                        <span>{institution.institutionName}</span>
                        {connectedLabel && (
                          <span style={{ fontSize: "0.75rem", color: "#6b7280", fontWeight: 500 }}>
                            {connectedLabel}
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          color: isDemoLiabilities
                            ? "#d32f2f"
                            : isDemoInvestments
                              ? "#1a73e8"
                              : "#5f6b7c",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {environmentLabel}
                      </span>
                    </div>
                  );
                })()}

                {institution.totals && (() => {
                  const totals = institution.totals as Record<string, number>;
                  return (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                        marginBottom: "0.6rem",
                      }}
                    >
                      {institution.groupType === "demo-investments" && (
                        <>
                          {"totalValue" in totals && (
                            <SummaryChip label="Total value" value={formatCurrency(totals.totalValue)} />
                          )}
                          {"totalCash" in totals && (
                            <SummaryChip label="Cash" value={formatCurrency(totals.totalCash)} />
                          )}
                          {"totalInvested" in totals && (
                            <SummaryChip label="Invested" value={formatCurrency(totals.totalInvested)} />
                          )}
                        </>
                      )}
                      {institution.groupType === "demo-liabilities" && (
                        <>
                          {"totalBalance" in totals && (
                            <SummaryChip label="Balance owed" value={formatCurrency(totals.totalBalance)} />
                          )}
                          {"totalMinimumPayment" in totals && (
                            <SummaryChip label="Min payments" value={formatCurrency(totals.totalMinimumPayment)} />
                          )}
                          {"totalPastDue" in totals && (
                            <SummaryChip label="Past due" value={formatCurrency(totals.totalPastDue)} />
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}

                {institution.errorMessage ? (
                  <div style={{ color: '#d32f2f', fontSize: '0.85rem', padding: '0.5rem 0' }}>
                    ⚠️ {institution.errorMessage}
                  </div>
                ) : (
                  <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
                    <tbody>
                      {institution.accounts.map((account, index) => {
                        const isLiabilityGroup = institution.groupType === "demo-liabilities";
                        const isBankGroup = institution.groupType === "demo-banking";
                        const balanceValue = account.balances.current ?? 0;
                        const displayBalance = isLiabilityGroup
                          ? `-${formatCurrency(Math.abs(balanceValue))}`
                          : formatCurrency(balanceValue);
                        const typeLabel = titleCase(account.subtype) || titleCase(account.type) || "Account";
                        const liabilityMeta = account.liabilityMeta;
                        const bankMeta = institution.meta;
                        return (
                          <tr
                            key={index}
                            style={{
                              borderBottom: index < institution.accounts.length - 1 ? '1px solid #f0f0f0' : 'none',
                            }}
                          >
                            <td style={{ padding: '0.4rem 0.2rem 0.4rem 0', textAlign: 'left', verticalAlign: 'top' }}>
                              <div style={{ fontWeight: 600, color: '#1a1f36' }}>{account.name}</div>
                              <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>
                                {typeLabel}
                              </div>
                              {isLiabilityGroup && liabilityMeta && (
                                <div style={{ fontSize: '0.75rem', color: '#374151', marginTop: '0.25rem' }}>
                                  Min payment {formatCurrency(liabilityMeta.minimumPaymentAmount)}
                                  {liabilityMeta.nextPaymentDueDate && (
                                    <>
                                      {' '}• Due {formatDate(liabilityMeta.nextPaymentDueDate)}
                                    </>
                                  )}
                                </div>
                              )}
                              {isBankGroup && bankMeta?.lastDeposit && (
                                <div style={{ fontSize: '0.75rem', color: '#256029', marginTop: '0.25rem', fontWeight: 500 }}>
                                  Last deposit {formatCurrency(bankMeta.lastDeposit.amount)} on {formatDate(bankMeta.lastDeposit.date)}
                                  {bankMeta.lastDeposit.description ? ` • ${bankMeta.lastDeposit.description}` : ''}
                                </div>
                              )}
                              {isBankGroup && bankMeta?.recentPayment && (
                                <div style={{ fontSize: '0.75rem', color: '#8b0000', marginTop: '0.2rem' }}>
                                  Recent payment {formatCurrency(Math.abs(bankMeta.recentPayment.amount))} on {formatDate(bankMeta.recentPayment.date)}
                                  {bankMeta.recentPayment.description ? ` • ${bankMeta.recentPayment.description}` : ''}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.4rem 0', textAlign: 'right', fontWeight: 600, color: isLiabilityGroup ? '#d32f2f' : '#1a1f36' }}>
                              {displayBalance}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Mount component
const root = document.getElementById("connected-institutions-root");
if (root) {
  createRoot(root).render(<ConnectedInstitutionsWidget />);
}
