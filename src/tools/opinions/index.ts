/**
 * Opinions Tools Registry
 * Tools for accessing expert financial analysis methodologies
 */

import { z } from "zod";
import { getOpinionById } from "../../storage/opinions/opinions.js";
import type { ToolDefinition } from "../types.js";

export function getOpinionTools(): ToolDefinition[] {
  return [
    {
      name: "get-opinion",
      description: "Get an expert opinion prompt to apply to your financial analysis. Returns the full analysis instructions for a specific methodology (e.g., Graham Stephan's 20% Rule, Minimalist budgeting).",
      inputSchema: {
        opinion_id: z
          .string()
          .describe("The ID of the opinion to retrieve (e.g., 'graham-20-percent-rule')"),
      },
      options: {
        readOnlyHint: true,
        securitySchemes: [{ type: "oauth2" }],
      },
      handler: async (args, { authInfo }, _deps) => {
        const userId = authInfo?.extra?.userId as string | undefined;
        if (!userId) {
          throw new Error("User authentication required");
        }

        const opinion = await getOpinionById(args.opinion_id);

        if (!opinion) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Opinion '${args.opinion_id}' not found.`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `## ${opinion.name}
By ${opinion.author}${opinion.author_url ? ` (${opinion.author_url})` : ""}

${opinion.description ? `${opinion.description}\n\n` : ""}---

${opinion.prompt}`,
            },
          ],
        };
      },
    },
  ];
}
