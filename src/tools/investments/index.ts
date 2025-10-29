/**
 * Investment Tools Registry
 * All investment-related MCP tools
 */

import { getInvestmentHoldingsHandler } from "./get-investment-holdings.js";
import type { ToolDefinition } from "../types.js";

export function getInvestmentTools(): ToolDefinition[] {
  return [
    {
      name: "get-investment-holdings",
      description:
        "View your investment portfolio across all connected investment accounts (401k, IRA, brokerage, crypto exchange). Shows total portfolio value, breakdown by security with current prices, quantity held, and gain/loss if cost basis is available. This is a read-only tool that provides instant access to your holdings data stored in the database.",
      inputSchema: {},
      options: {
        readOnlyHint: true,
        securitySchemes: [{ type: "oauth2" }],
      },
      handler: async (_args, { authInfo }, _deps) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        return getInvestmentHoldingsHandler(userId);
      },
    },
  ];
}
