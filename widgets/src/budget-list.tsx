import React, { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";

// Types matching our tool output
interface Budget {
  id: string;
  title: string;
  amount: number;
  period: string;
  customPeriodDays?: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: "under" | "near" | "over";
  dateRange: {
    start: string;
    end: string;
  };
  transactionCount: number;
  error?: string;
}

interface BudgetListOutput {
  budgets: Budget[];
}

// Hook to subscribe to window.openai.toolOutput changes
function useToolOutput(): BudgetListOutput | null {
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

      window.addEventListener(
        "openai:set_globals",
        handleSetGlobals as EventListener
      );
      return () => {
        window.removeEventListener(
          "openai:set_globals",
          handleSetGlobals as EventListener
        );
      };
    },
    () => (window as any).openai?.toolOutput ?? null,
    () => null // Server-side rendering fallback
  );
}

function BudgetListWidget() {
  const toolOutput = useToolOutput();

  // While waiting for data, show loading state
  if (toolOutput === null) {
    return (
      <div className="budget-list-widget">
        <div
          className="loading-state"
          style={{ padding: "2rem", textAlign: "center", color: "#666" }}
        >
          <p>Loading budgets...</p>
        </div>
      </div>
    );
  }

  const budgets = toolOutput.budgets || [];

  return (
    <div className="budget-list-widget">
      {budgets.length === 0 ? (
        <div className="empty-state">
          <p style={{ color: "#666", textAlign: "center", padding: "1rem" }}>
            No budgets found
          </p>
          <p
            style={{
              fontSize: "0.9rem",
              color: "#999",
              textAlign: "center",
              marginTop: "0.5rem",
            }}
          >
            Create your first budget to get started
          </p>
        </div>
      ) : (
        <div className="budgets-list">
          {budgets.map((budget, index) => (
            <BudgetCard key={budget.id} budget={budget} isFirst={index === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

interface BudgetCardProps {
  budget: Budget;
  isFirst: boolean;
}

function BudgetCard({ budget, isFirst }: BudgetCardProps) {
  // Handle error state
  if (budget.error) {
    return (
      <div>
        {!isFirst && (
          <div
            style={{
              height: "1px",
              background: "#e0e0e0",
              margin: "0.75rem 0",
            }}
          />
        )}
        <div
          style={{
            padding: "1rem",
            background: "#fff3f3",
            borderRadius: "8px",
            border: "1px solid #ffcccb",
          }}
        >
          <div style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
            {budget.title}
          </div>
          <div style={{ color: "#d32f2f", fontSize: "0.9rem" }}>
            Error: {budget.error}
          </div>
        </div>
      </div>
    );
  }

  // Determine colors based on status
  const getStatusColor = () => {
    switch (budget.status) {
      case "over":
        return "#d32f2f"; // Red
      case "near":
        return "#f57c00"; // Orange
      case "under":
        return "#388e3c"; // Green
      default:
        return "#666";
    }
  };

  const getProgressBarColor = () => {
    switch (budget.status) {
      case "over":
        return "#f44336"; // Red
      case "near":
        return "#ff9800"; // Orange
      case "under":
        return "#4caf50"; // Green
      default:
        return "#999";
    }
  };

  const statusEmoji =
    budget.status === "over" ? "🔴" : budget.status === "near" ? "🟡" : "🟢";

  // Format period display
  const periodDisplay = budget.customPeriodDays
    ? `${budget.customPeriodDays} days`
    : budget.period;

  // Cap percentage at 100 for display
  const displayPercentage = Math.min(budget.percentage, 100);

  return (
    <div>
      {!isFirst && (
        <div
          style={{ height: "1px", background: "#e0e0e0", margin: "0.75rem 0" }}
        />
      )}

      <div className="budget-card">
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.5rem",
          }}
        >
          <div style={{ fontWeight: "600", fontSize: "0.95rem" }}>
            {statusEmoji} {budget.title}
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "#999",
              textTransform: "capitalize",
            }}
          >
            {periodDisplay}
          </div>
        </div>

        {/* Amount Display */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "0.5rem",
          }}
        >
          <div style={{ fontSize: "1.1rem", fontWeight: "600" }}>
            ${budget.spent.toFixed(2)}{" "}
            <span style={{ fontSize: "0.85rem", color: "#666" }}>
              / ${budget.amount.toFixed(2)}
            </span>
          </div>
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: "600",
              color: getStatusColor(),
            }}
          >
            {budget.percentage}%
          </div>
        </div>

        {/* Progress Bar */}
        <div
          style={{
            width: "100%",
            height: "8px",
            background: "#e0e0e0",
            borderRadius: "4px",
            overflow: "hidden",
            marginBottom: "0.5rem",
          }}
        >
          <div
            style={{
              width: `${displayPercentage}%`,
              height: "100%",
              background: getProgressBarColor(),
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Footer Info */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.75rem",
            color: "#666",
          }}
        >
          <div>
            Remaining:{" "}
            <span
              style={{ fontWeight: "600", color: getStatusColor() }}
            >
              ${budget.remaining.toFixed(2)}
            </span>
          </div>
          <div>{budget.transactionCount} transactions</div>
        </div>
      </div>
    </div>
  );
}

// Mount component
const root = document.getElementById("budget-list-root");
if (root) {
  createRoot(root).render(<BudgetListWidget />);
}
