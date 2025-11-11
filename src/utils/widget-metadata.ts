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
   * Account Balances Widget
   * Interactive cards showing connected financial institutions with account balances.
   * Used by: get-account-balances, get-account-status
   */
  accountBalances: {
    "openai/outputTemplate": "ui://widget/connected-institutions.html",
    "openai/toolInvocation/invoking": "Loading your account balances...",
    "openai/toolInvocation/invoked": "Account balances loaded",
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
