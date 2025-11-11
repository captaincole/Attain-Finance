import React, { useSyncExternalStore } from "react";

export interface NextStepAction {
  id: string;
  label: string;
  icon?: string;
  description?: string;
  kind: "tool" | "prompt";
  tool?: string;
  toolArgs?: Record<string, unknown>;
  prompt?: string;
  variant?: "primary" | "secondary";
}

export function formatCurrency(amount: number | undefined): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return "$0.00";
  }

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatRelativeTime(date: Date | null): string {
  if (!date) return "—";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? "s" : ""} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

  return date.toLocaleDateString();
}

export function useToolOutput<T>(): T | null {
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

export function getFallbackNextSteps(): NextStepAction[] {
  return [
    {
      id: "connect-account",
      label: "Connect Account",
      kind: "tool",
      tool: "connect-account",
      toolArgs: {},
      variant: "primary",
    },
    {
      id: "analyze-spending",
      label: "Analyze Spending",
      kind: "prompt",
      prompt: "Analyze my recent spending and highlight anything unusual.",
      variant: "secondary",
    },
    {
      id: "add-advisor",
      label: "Add an Advisor",
      kind: "prompt",
      prompt: "Walk me through how to invite my financial advisor into this workspace.",
      variant: "secondary",
    },
  ];
}

export function normalizeNextSteps(steps?: NextStepAction[]): NextStepAction[] {
  const list = steps && steps.length > 0 ? steps : getFallbackNextSteps();
  return list.map((step) => ({
    variant: step.variant ?? (step.id === "connect-account" ? "primary" : "secondary"),
    ...step,
  }));
}
