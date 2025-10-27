import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { logToolEvent, serializeError } from "../../utils/logger.js";

const saveHomepageSchema = z.object({
  prompt: z.string().min(1).max(4000),
  title: z.string().optional(),
  tools: z.array(z.string()).max(12).optional(),
  sections: z
    .array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        widget: z.string().optional(),
      })
    )
    .optional(),
  notes: z.string().optional(),
});

export function getSaveFinancialHomepageTool(): ToolDefinition {
  return {
    name: "save-financial-homepage",
    description:
      "Demo placeholder: accept a prompt describing the Financial Home layout so the assistant can pretend to save it.",
    inputSchema: saveHomepageSchema.shape,
    options: {
      securitySchemes: [{ type: "oauth2" }],
      readOnlyHint: true,
      _meta: {
        "openai/toolInvocation/invoked":
          "Financial Home prompt ready. Execute the returned instruction and call necessary tools to rebuild the dashboard.",
      },
    },
    handler: async (args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;
      if (!userId) {
        throw new Error("User authentication required");
      }

      const parsed = saveHomepageSchema.parse(args ?? {});
      const normalizedPrompt = parsed.prompt.trim();
      if (!normalizedPrompt) {
        throw new Error("Prompt is required to save a financial homepage.");
      }

      return {
        content: [
          {
            type: "text" as const,
            text: "**Saved Financial Home (Demo)**\n\nYour financial homepage prompt is noted.",
          },
        ],
        structuredContent: undefined,
      };
    },
  };
}

export function getFinancialHomepageTool(): ToolDefinition {
  return {
    name: "get-financial-homepage",
    description:
      "Retrieve the Financial Home prompt and explicit instructions so the assistant can immediately rebuild the saved dashboard.",
    inputSchema: {},
    options: {
      securitySchemes: [{ type: "oauth2" }],
      readOnlyHint: true,
      _meta: {
        "openai/toolInvocation/invoked":
          "Financial Home prompt loaded. Execute the returned instructions and call any required tools.",
      },
    },
    handler: async (_args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;
      if (!userId) {
        throw new Error("User authentication required");
      }

      try {
        const demoPrompt =
          "Show me my accounts, and show me a bar chart 30 day summary of my transactions grouped by category";
        const instructions = [
          "1. Execute the saved prompt immediately.",
          "2. Call `get-account-balances` to populate the accounts widget.",
          "3. Call `get-transactions` and generate a 30-day bar chart grouped by category.",
          "4. Summarize savings progress and highlight notable budget variances.",
          "5. Offer next-step recommendations (e.g., mortgage readiness, savings goals).",
        ].join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `**Financial Home (Demo)**\n\n${instructions}\n\n**Prompt to execute:**\n${demoPrompt}`,
            },
          ],
          structuredContent: {
            homepage: {
              prompt: demoPrompt,
              title: "Financial Home",
              tools: [],
              sections: [],
              notes: null,
              isPersisted: false,
            },
            instructions,
          },
        };
      } catch (error) {
        logToolEvent(
          "get-financial-homepage",
          "error",
          { error: serializeError(error) },
          "error"
        );
        throw error;
      }
    },
  };
}
