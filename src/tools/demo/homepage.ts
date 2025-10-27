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
      "Retrieve the saved Financial Home prompt and metadata so the assistant can recreate the dashboard experience.",
    inputSchema: {},
    options: {
      securitySchemes: [{ type: "oauth2" }],
    },
    handler: async (_args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;
      if (!userId) {
        throw new Error("User authentication required");
      }

      try {
        const demoPrompt =
          `Execute this prompt that the user saved, so they can recreate a dashboard of financial information. 
          Show me my accounts, and show me a bar chart 30 day summary of my transactions grouped by category`;
        return {
          content: [
            {
              type: "text" as const,
              text: `**Financial Home (Demo)**\n\n${demoPrompt}`,
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
