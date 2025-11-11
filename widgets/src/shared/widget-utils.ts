import React, { useSyncExternalStore } from "react";

export interface OpenAIWidgetBridge {
  toolOutput?: unknown;
  widgetState?: WidgetStateSnapshot | null;
  setWidgetState?: (state: WidgetStateSnapshot | null) => void | Promise<void>;
  callTool?: (name: string, args?: Record<string, unknown>) => Promise<unknown>;
  sendFollowupTurn?: (payload: { prompt: string }) => Promise<unknown>;
}

export interface WidgetStateSnapshot {
  pendingActionId?: string | null;
  [key: string]: unknown;
}

declare global {
  interface Window {
    openai?: OpenAIWidgetBridge;
  }
}

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
    () => (getOpenAIBridge()?.toolOutput as T | null | undefined) ?? null,
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

export function getOpenAIBridge(): OpenAIWidgetBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return window.openai;
}

export function getInitialWidgetState<T extends WidgetStateSnapshot = WidgetStateSnapshot>(): T | null {
  return (getOpenAIBridge()?.widgetState as T | null | undefined) ?? null;
}

export function getInitialPendingActionId(defaultValue: string | null = null): string | null {
  const widgetState = getInitialWidgetState();
  const pending = widgetState?.pendingActionId;
  if (pending === null || typeof pending === "string") {
    return pending;
  }
  return defaultValue;
}

export async function persistWidgetState(patch: Partial<WidgetStateSnapshot>): Promise<void> {
  const bridge = getOpenAIBridge();
  if (!bridge?.setWidgetState) return;

  const currentState: WidgetStateSnapshot = {
    ...(bridge.widgetState ?? {}),
  };

  const nextState: WidgetStateSnapshot = {
    ...currentState,
    ...patch,
  };

  // Clean up undefined values so we do not persist stray keys
  Object.keys(nextState).forEach((key) => {
    if (nextState[key] === undefined) {
      delete nextState[key];
    }
  });

  await bridge.setWidgetState(nextState);
  bridge.widgetState = nextState;
}

export async function persistPendingActionId(actionId: string | null): Promise<void> {
  await persistWidgetState({ pendingActionId: actionId });
}
