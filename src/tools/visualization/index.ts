/**
 * Visualization Tools Registry
 * Tools for customizing spending visualizations
 */

import { z } from "zod";
import { updateVisualizationHandler, resetVisualizationHandler } from "./handlers.js";
import { getBaseUrl } from "../../utils/config.js";
import type { ToolDefinition } from "../plaid/index.js";

export function getVisualizationTools(): ToolDefinition[] {
  return [
    {
      name: "update-visualization",
      description: "Customize your spending visualization with natural language. Examples: 'Make all the bars green', 'Show top 15 categories instead of 10', 'Change bar character to circles'. Uses AI to modify the bash script and saves your custom version.",
      inputSchema: {
        request: z
          .string()
          .describe("Natural language customization request (e.g., 'make bars green')"),
      },
      options: {
        securitySchemes: [{ type: "oauth2" }],
      },
      handler: async (args, { authInfo }) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        const baseUrl = getBaseUrl();
        return updateVisualizationHandler(userId, baseUrl, args);
      },
    },
    {
      name: "reset-visualization",
      description: "Reset your visualization script to the default version. Use this if you want to start over with customizations.",
      inputSchema: {},
      options: {
        securitySchemes: [{ type: "oauth2" }],
      },
      handler: async (_args, { authInfo }) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        const baseUrl = getBaseUrl();
        return resetVisualizationHandler(userId, baseUrl);
      },
    },
  ];
}
