import React, { useMemo, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";

interface Account {
  name: string;
  type: string;
  subtype?: string | null;
  current_balance?: number | null;
}

interface ConnectedInstitutionsOutput {
  accounts?: Account[];
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
  const toolOutput = useToolOutput();
  const accounts = toolOutput?.accounts ?? [];

  const groups = useMemo(() => {
    const mapping: Record<string, { label: string; accounts: Account[] }> = {
      cash: { label: "Cash & Checking", accounts: [] },
      investments: { label: "Investments", accounts: [] },
      credit: { label: "Credit", accounts: [] },
      loans: { label: "Loans", accounts: [] },
      other: { label: "Other", accounts: [] },
    };

    accounts.forEach((account) => {
      const type = account.type;
      if (type === "depository") {
        mapping.cash.accounts.push(account);
      } else if (type === "investment") {
        mapping.investments.accounts.push(account);
      } else if (type === "credit") {
        mapping.credit.accounts.push(account);
      } else if (type === "loan") {
        mapping.loans.accounts.push(account);
      } else {
        mapping.other.accounts.push(account);
      }
    });

    return [mapping.cash, mapping.investments, mapping.credit, mapping.loans, mapping.other].filter(
      (group) => group.accounts.length > 0
    );
  }, [accounts]);

  if (!toolOutput) {
    return (
      <div className="institutions-widget">
        <div style={{ padding: "1rem", textAlign: "center", color: "#6b7280" }}>Loading accounts…</div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="institutions-widget">
        <div className="empty-state">
          <p>No accounts available in this demo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="institutions-widget" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {groups.map((group) => (
        <div key={group.label} style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", textTransform: "uppercase" }}>
            {group.label}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {group.accounts.map((account, index) => {
              const balance = account.current_balance ?? 0;
              const isLiability = account.type === "credit" || account.type === "loan";
              const displayBalance = isLiability
                ? `-${formatCurrency(Math.abs(balance))}`
                : formatCurrency(balance);

              return (
                <div
                  key={`${account.name}-${index}`}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.85rem",
                    color: "#1f2937",
                    borderBottom: "1px solid #e2e8f0",
                    paddingBottom: "0.25rem",
                  }}
                >
                  <span>{account.name}</span>
                  <span style={{ fontWeight: 600, color: isLiability ? "#b91c1c" : "#0f172a" }}>
                    {displayBalance}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Mount component
const root = document.getElementById("connected-institutions-root");
if (root) {
  createRoot(root).render(<ConnectedInstitutionsWidget />);
}
