import React, { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";

interface DemoTransactionMeta {
  amount: number;
  date: string;
  description: string;
}

interface BalanceSheetData {
  assets: {
    cash: number;
    investments: number;
    total: number;
  };
  liabilities: {
    debts: number;
    minimumPayments: number;
    total: number;
  };
  netWorth: number;
}

interface CashflowData {
  availableBalance: number;
  inflow30Days: number;
  outflow30Days: number;
  lastDeposit?: DemoTransactionMeta | null;
  recentPayment?: DemoTransactionMeta | null;
}

interface ConnectedInstitutionsOutput {
  balanceSheet?: BalanceSheetData;
  summary?: {
    balanceSheet?: BalanceSheetData;
    demoBanking?: CashflowData | null;
  };
  demoData?: {
    banking?: CashflowData | null;
  };
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

function SummaryChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}) {
  const toneColor =
    tone === "positive" ? "#256029" : tone === "negative" ? "#b71c1c" : "#1a1f36";

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
      <span style={{ fontWeight: 600, color: toneColor }}>{value}</span>
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

  const balanceSheet: BalanceSheetData | undefined =
    toolOutput.balanceSheet || toolOutput.summary?.balanceSheet;
  const cashflow: CashflowData | undefined =
    toolOutput.summary?.demoBanking || toolOutput.demoData?.banking || undefined;

  if (!balanceSheet) {
    return (
      <div className="institutions-widget">
        <div className="empty-state">
          <p>Balance sheet data unavailable.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="institutions-widget">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.8rem",
          paddingBottom: "0.4rem",
          borderBottom: "2px solid #e0e0e0",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Balance Sheet Snapshot</h3>
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          marginBottom: "0.9rem",
        }}
      >
        <SummaryChip label="Total Assets" value={formatCurrency(balanceSheet.assets.total)} />
        <SummaryChip
          label="Liabilities"
          value={formatCurrency(balanceSheet.liabilities.total)}
          tone="negative"
        />
        <SummaryChip
          label="Net Worth"
          value={formatCurrency(balanceSheet.netWorth)}
          tone={balanceSheet.netWorth >= 0 ? "positive" : "negative"}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.75rem",
        }}
      >
        <div
          style={{
            background: "#fafbff",
            borderRadius: "0.6rem",
            padding: "0.75rem",
            border: "1px solid #e0e7ff",
          }}
        >
          <div style={{ fontSize: "0.78rem", color: "#5f6b7c", fontWeight: 600 }}>Assets</div>
          <div style={{ marginTop: "0.45rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#1a1f36" }}>Cash & Checking</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(balanceSheet.assets.cash)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#1a1f36" }}>Investments</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(balanceSheet.assets.investments)}</span>
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#fff8f5",
            borderRadius: "0.6rem",
            padding: "0.75rem",
            border: "1px solid #ffe3d6",
          }}
        >
          <div style={{ fontSize: "0.78rem", color: "#b93815", fontWeight: 600 }}>Liabilities</div>
          <div style={{ marginTop: "0.45rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#4b1f12" }}>Debt Outstanding</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(balanceSheet.liabilities.debts)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#4b1f12" }}>Min payments</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(balanceSheet.liabilities.minimumPayments)}</span>
            </div>
          </div>
        </div>

        {cashflow && (
          <div
            style={{
              background: "#f0f9ff",
              borderRadius: "0.6rem",
              padding: "0.75rem",
              border: "1px solid #d0ebff",
            }}
          >
            <div style={{ fontSize: "0.78rem", color: "#0b5394", fontWeight: 600 }}>Cashflow (30 days)</div>
            <div style={{ marginTop: "0.45rem", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Inflows</span>
                <span style={{ fontWeight: 600, color: "#256029" }}>{formatCurrency(cashflow.inflow30Days)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Outflows</span>
                <span style={{ fontWeight: 600, color: "#b71c1c" }}>{formatCurrency(cashflow.outflow30Days)}</span>
              </div>
              {cashflow.lastDeposit && (
                <div style={{ fontSize: "0.75rem", color: "#256029" }}>
                  Last deposit {formatCurrency(cashflow.lastDeposit.amount)} on {formatDate(cashflow.lastDeposit.date)}
                </div>
              )}
              {cashflow.recentPayment && (
                <div style={{ fontSize: "0.75rem", color: "#b71c1c" }}>
                  Latest payment {formatCurrency(Math.abs(cashflow.recentPayment.amount))} on {formatDate(cashflow.recentPayment.date)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Mount component
const root = document.getElementById("connected-institutions-root");
if (root) {
  createRoot(root).render(<ConnectedInstitutionsWidget />);
}
