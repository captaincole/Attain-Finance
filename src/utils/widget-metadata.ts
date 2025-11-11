/**
 * Widget Metadata Configuration
 *
 * Centralized widget metadata for MCP tools that support ChatGPT widget rendering.
 *
 * IMPORTANT: This metadata is used in tool definitions and must match the pattern
 * expected by ChatGPT's MCP widget system:
 * - "openai/outputTemplate": URI of the widget HTML resource
 * - "openai/toolInvocation/invoking": Loading message shown while tool executes
 * - "openai/toolInvocation/invoked": Success message after tool completes
 * - "openai/widgetAccessible": Indicates widget is available
 * - "openai/resultCanProduceWidget": Indicates tool output includes widget data
 *
 * See docs/MCP_WIDGETS_SETUP.md for more details on widget configuration.
 */

export const WIDGET_META = {
  /**
   * Financial Summary Widget
   */
  financialSummary: {
    "openai/outputTemplate": "ui://widget/financial-summary.html",
    "openai/toolInvocation/invoking": "Loading your financial summary...",
    "openai/toolInvocation/invoked": "Summary ready",
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
  },

  /**
   * Account Status Widget
   */
  accountStatus: {
    "openai/outputTemplate": "ui://widget/account-status.html",
    "openai/toolInvocation/invoking": "Loading your account status...",
    "openai/toolInvocation/invoked": "Accounts loaded",
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
  },

  /**
   * Budget List Widget
   * Interactive budget cards showing spending progress with color-coded status bars.
   * Used by: get-budgets, create-budget, update-budget-rules
   */
  budgetList: {
    "openai/outputTemplate": "ui://widget/budget-list.html",
    "openai/toolInvocation/invoking": "Calculating budget status...",
    "openai/toolInvocation/invoked": "Budget status loaded",
    "openai/widgetAccessible": true,
    "openai/resultCanProduceWidget": true,
  },
} as const;
