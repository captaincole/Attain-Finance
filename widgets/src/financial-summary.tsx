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

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

interface NetWorthTrend {
  amountChange: number;
  percentChange: number | null;
  direction: "up" | "down" | "flat";
  label?: string;
  baselineDate?: string;
}

interface HeroData {
  netWorth: number;
  assetsTotal: number;
  liabilitiesTotal: number;
  lastUpdatedAt?: string | null;
  trend?: NetWorthTrend | null;
  hasData?: boolean;
  nextSteps?: NextStepAction[];
}

interface FinancialSummaryOutput {
  summary?: {
    netWorth?: number;
    assetsTotal?: number;
    liabilitiesTotal?: number;
    lastSynced?: string | null;
    netWorthTrend?: NetWorthTrend | null;
    totalAccounts?: number;
  };
  dashboard?: {
    hero?: HeroData;
  };
}

function FinancialSummaryWidget() {
  const toolOutput = useToolOutput<FinancialSummaryOutput>();
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

  const accountCount = toolOutput.summary?.totalAccounts ?? 0;
  const heroSource = toolOutput.dashboard?.hero
    ? toolOutput.dashboard.hero
    : toolOutput.summary
    ? {
        netWorth: toolOutput.summary.netWorth ?? 0,
        assetsTotal: toolOutput.summary.assetsTotal ?? 0,
        liabilitiesTotal: toolOutput.summary.liabilitiesTotal ?? 0,
        lastUpdatedAt: toolOutput.summary.lastSynced,
        trend: toolOutput.summary.netWorthTrend ?? null,
        hasData: (toolOutput.summary.totalAccounts ?? 0) > 0,
      }
    : null;

  if (!heroSource) {
    return (
      <div className="institutions-widget">
        <div className="empty-state">
          <p>No financial data yet</p>
          <p style={{ fontSize: "0.9rem", color: "#475569", marginTop: "0.5rem" }}>
            Use "Connect my account" to get started.
          </p>
        </div>
      </div>
    );
  }

  const hero = {
    ...heroSource,
    nextSteps: normalizeNextSteps(heroSource.nextSteps),
  };

  const heroTrend = hero.trend ?? null;
  const lastSyncedAt = hero.lastUpdatedAt ? new Date(hero.lastUpdatedAt) : null;

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
      <div className="next-steps-row next-steps-hero">
        <div className="next-steps-grid">
          {steps.map((step) => (
            <button
              key={`hero-${step.id}`}
              className={`next-step-pill ${step.variant ?? "secondary"}${pendingActionId === step.id ? " loading" : ""}`}
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
      <section className="dashboard-hero">
        <div className="tool-badge">Financial Summary</div>
        <div className="hero-header">
          <div className="hero-title">Net Worth</div>
          <div className="hero-value">{formatCurrency(hero.netWorth)}</div>
          <div className="hero-trend-row">
            {heroTrend ? (
              <div className={`hero-trend trend-${heroTrend.direction}`}>
                <span className="hero-trend-amount">
                  {heroTrend.direction === "down" ? "↓" : heroTrend.direction === "up" ? "↑" : "→"}{" "}
                  {formatCurrency(heroTrend.amountChange)}
                </span>
                {heroTrend.percentChange !== null && heroTrend.percentChange !== undefined && (
                  <span className="hero-trend-percent">
                    ({heroTrend.percentChange >= 0 ? "+" : ""}
                    {percentFormatter.format(heroTrend.percentChange)}%)
                  </span>
                )}
                <span className="hero-trend-label">{heroTrend.label ?? "since last snapshot"}</span>
              </div>
            ) : (
              <div className="hero-trend trend-flat">Trend data appears after your first weekly snapshot</div>
            )}
          </div>
          {lastSyncedAt && <div className="hero-updated">Updated {formatRelativeTime(lastSyncedAt)}</div>}
        </div>
        <div className="hero-stats">
          <div>
            <span>Assets</span>
            <strong>{formatCurrency(hero.assetsTotal)}</strong>
          </div>
          <div>
            <span>Liabilities</span>
            <strong>{formatCurrency(hero.liabilitiesTotal)}</strong>
          </div>
            <div>
              <span>Accounts</span>
              <strong>{accountCount}</strong>
            </div>
        </div>
        {renderNextSteps(hero.nextSteps ?? [])}
      </section>
    </div>
  );
}

const root = document.getElementById("financial-summary-root");
if (root) {
  createRoot(root).render(<FinancialSummaryWidget />);
}
