/**
 * Financial Summary Tools Registry
 * Dashboard overview with net worth and trend analysis
 */

import {
  getFinancialSummaryHandler,
  GetFinancialSummaryOutputSchema,
} from "./get-financial-summary.js";
import { WIDGET_META } from "../../utils/widget-metadata.js";
import type { ToolDefinition } from "../types.js";

export function getFinancialSummaryTools(): ToolDefinition[] {
  return [
    {
      name: "financial-summary",
      description:
        "Get a comprehensive overview of your financial status including net worth, assets, liabilities, and week-over-week trends. Shows account balances grouped by type and provides suggested next steps. This is a read-only tool that provides instant access to your financial data stored in the database.",
      inputSchema: {},
      outputSchema: GetFinancialSummaryOutputSchema,
      options: {
        readOnlyHint: true,
        securitySchemes: [{ type: "oauth2" }],
        _meta: WIDGET_META.financialSummary,
      },
      handler: async (_args, { authInfo }, _deps) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        return getFinancialSummaryHandler(userId);
      },
    },
  ];
}
