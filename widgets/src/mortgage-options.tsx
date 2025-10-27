import React, { useMemo, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";

interface MortgageOption {
  lender: string;
  productName: string;
  apr: number;
  monthlyPayment: number;
  closingCosts: number;
  termYears: number;
  rateType: string;
  link: string;
  notes?: string;
}

interface MortgageWidgetOutput {
  mortgageOptions?: MortgageOption[];
  instructions?: string;
  followUpPrompt?: string;
}

function useToolOutput(): MortgageWidgetOutput | null {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") {
        return () => {};
      }
      const handler = (event: CustomEvent) => {
        if (event.detail?.globals?.toolOutput !== undefined) {
          onChange();
        }
      };
      window.addEventListener("openai:set_globals", handler as EventListener);
      return () => window.removeEventListener("openai:set_globals", handler as EventListener);
    },
    () => (window as any).openai?.toolOutput ?? null,
    () => null
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function MortgageOptionsWidget() {
  const output = useToolOutput();
  const options = useMemo(() => output?.mortgageOptions ?? [], [output]);
  const instructions = output?.instructions || output?.followUpPrompt || null;

  if (!output) {
    return (
      <div className="mortgage-widget">
        <div className="mortgage-widget__empty">Loading mortgage recommendations…</div>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="mortgage-widget">
        <div className="mortgage-widget__empty">No mortgage options available.</div>
      </div>
    );
  }

  return (
    <div className="mortgage-widget">
      {options.map((option, idx) => (
        <div key={`${option.lender}-${idx}`} className="mortgage-card">
          <div className="mortgage-card__main">
            <div className="mortgage-card__title">
              <span className="mortgage-card__lender">{option.lender}</span>
              <span className="mortgage-card__product">{option.productName}</span>
            </div>
            <div className="mortgage-card__metrics">
              <span className="metric">
                <span className="metric__label">APR</span>
                <span className="metric__value">{option.apr.toFixed(2)}%</span>
              </span>
              <span className="metric">
                <span className="metric__label">Payment</span>
                <span className="metric__value">{formatCurrency(option.monthlyPayment)}/mo</span>
              </span>
              <span className="metric">
                <span className="metric__label">Closing</span>
                <span className="metric__value">{formatCurrency(option.closingCosts)}</span>
              </span>
              <span className="metric">
                <span className="metric__label">Term</span>
                <span className="metric__value">
                  {option.termYears} yr {option.rateType.toUpperCase()}
                </span>
              </span>
            </div>
            {option.notes && <div className="mortgage-card__notes">{option.notes}</div>}
          </div>
          <a className="mortgage-card__apply" href={option.link} target="_blank" rel="noreferrer">
            Apply
          </a>
        </div>
      ))}
      {instructions ? (
        <div className="mortgage-widget__instructions">
          {instructions}
        </div>
      ) : null}
    </div>
  );
}

const root = document.getElementById("mortgage-options-root");
if (root) {
  createRoot(root).render(<MortgageOptionsWidget />);
}
