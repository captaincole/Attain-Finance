import React, { useMemo, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";

interface CategoryTotal {
  category: string;
  amount: number;
  transactionCount: number;
}

interface SpendingSummaryOutput {
  categoryTotals?: CategoryTotal[];
  summary?: {
    spendingTotal?: number;
    paymentsTotal?: number;
    incomeTotal?: number;
  };
}

function formatCurrency(value?: number): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

function useToolOutput(): SpendingSummaryOutput | null {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") {
        return () => {};
      }

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
    () => null
  );
}

function SpendingSummaryWidget() {
  const toolOutput = useToolOutput();

  if (!toolOutput) {
    return (
      <div style={{ padding: "1rem", textAlign: "center", color: "#6b7280" }}>
        Loading spending summary…
      </div>
    );
  }

  const categories = toolOutput.categoryTotals || [];

  const topCategories = useMemo(() => {
    return categories.slice(0, 6);
  }, [categories]);

  const maxAmount = useMemo(() => {
    return Math.max(...topCategories.map((cat) => cat.amount), 1);
  }, [topCategories]);

  const spendingTotal = toolOutput.summary?.spendingTotal || 0;
  const paymentsTotal = toolOutput.summary?.paymentsTotal || 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Recent Spending</h3>
        <span style={{ fontSize: "0.8rem", color: "#6b7280" }}>Last 60 days</span>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <div
          style={{
            background: "#f1f5f9",
            borderRadius: "0.5rem",
            padding: "0.6rem 0.8rem",
            display: "flex",
            flexDirection: "column",
            minWidth: "120px",
            gap: "0.25rem",
          }}
        >
          <span style={{ color: "#475569", fontSize: "0.75rem", fontWeight: 600 }}>Spending</span>
          <span style={{ color: "#1f2937", fontWeight: 700 }}>{formatCurrency(spendingTotal)}</span>
        </div>
        <div
          style={{
            background: "#fef2f2",
            borderRadius: "0.5rem",
            padding: "0.6rem 0.8rem",
            display: "flex",
            flexDirection: "column",
            minWidth: "120px",
            gap: "0.25rem",
          }}
        >
          <span style={{ color: "#b91c1c", fontSize: "0.75rem", fontWeight: 600 }}>Payments</span>
          <span style={{ color: "#991b1b", fontWeight: 700 }}>{formatCurrency(paymentsTotal)}</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {topCategories.length === 0 ? (
          <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
            No spending activity recorded in this window.
          </div>
        ) : (
          topCategories.map((category) => {
            const widthPercent = Math.max((category.amount / maxAmount) * 100, 4);
            return (
              <div key={category.category} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "#1f2937" }}>
                  <span>{category.category}</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(category.amount)}</span>
                </div>
                <div style={{ height: "8px", borderRadius: "999px", background: "#e2e8f0" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${widthPercent}%`,
                      borderRadius: "999px",
                      background: "linear-gradient(90deg, #3b82f6, #2563eb)",
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const rootElement = document.getElementById("spending-summary-root");
if (rootElement) {
  createRoot(rootElement).render(<SpendingSummaryWidget />);
}
