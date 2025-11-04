/**
 * Liabilities Tools Registry
 * All liability-related MCP tools
 */

import { z } from "zod";
import { getLiabilitiesHandler } from "./get-liabilities.js";
import type { ToolDefinition } from "../types.js";

export function getLiabilityTools(): ToolDefinition[] {
  return [
    {
      name: "get-liabilities",
      description:
        "View your liabilities across all connected accounts including credit cards, mortgages, and student loans. Shows payment schedules, interest rates, balances, and overdue status. Optionally filter by liability type (credit, mortgage, or student). Data is fetched from Plaid on first call and then cached in the database for instant access.",
      inputSchema: {
        type: z.enum(["credit", "mortgage", "student"]).optional().describe("Optional filter by liability type"),
      },
      options: {
        readOnlyHint: true,
        securitySchemes: [{ type: "oauth2" }],
      },
      handler: async (args, { authInfo }, deps) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        const type = args.type as "credit" | "mortgage" | "student" | undefined;
        const plaidClient = (deps as any)?.plaidClient;

        return getLiabilitiesHandler(userId, type, plaidClient);
      },
    },
  ];
}
