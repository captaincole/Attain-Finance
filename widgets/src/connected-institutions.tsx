import React, { useMemo, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";

interface Account {
  name: string;
  type: string;
  subtype?: string | null;
  current_balance?: number | null;
  institution_name?: string | null;
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
    <div
      className="institutions-widget"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        padding: "0.75rem 0.5rem 0.9rem",
      }}
    >
      {groups.map((group) => {
        const groupTotal = group.accounts.reduce((sum, account) => {
          const balance = account.current_balance ?? 0;
          const isLiability = account.type === "credit" || account.type === "loan";
          return sum + (isLiability ? -Math.abs(balance) : balance);
        }, 0);

        return (
          <div
            key={group.label}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.45rem",
              padding: "0.15rem 0",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569", textTransform: "uppercase" }}>
                {group.label}
              </div>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1e293b" }}>
                {formatCurrency(groupTotal)}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
              {group.accounts.map((account, index) => {
                const balance = account.current_balance ?? 0;
                const isLiability = account.type === "credit" || account.type === "loan";
                const displayBalance = isLiability
                  ? `-${formatCurrency(Math.abs(balance))}`
                  : formatCurrency(balance);
                const subtitleParts: string[] = [];
                if (account.institution_name) {
                  subtitleParts.push(account.institution_name);
                }
                if (account.subtype) {
                  subtitleParts.push(account.subtype);
                }
                const subtitle = subtitleParts.join(" • ");

                return (
                  <div
                    key={`${account.name}-${index}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                      backgroundColor: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "0.65rem 0.75rem",
                      boxShadow: "inset 0 1px 0 rgba(148, 163, 184, 0.18)",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                      <span style={{ fontSize: "0.92rem", fontWeight: 600, color: "#0f172a" }}>
                        {account.name}
                      </span>
                      {subtitle && (
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{subtitle}</span>
                      )}
                    </div>
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: "0.95rem",
                        color: isLiability ? "#dc2626" : "#047857",
                      }}
                    >
                      {displayBalance}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Mount component
const root = document.getElementById("connected-institutions-root");
if (root) {
  createRoot(root).render(<ConnectedInstitutionsWidget />);
}
