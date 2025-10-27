import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import { logToolEvent, serializeError } from "../../utils/logger.js";

const homepageSectionSchema = z.object({
  title: z
    .string()
    .min(1, "Section title cannot be empty")
    .max(160, "Section titles should be concise"),
  description: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  widget: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
});

const saveHomepageSchema = z.object({
  prompt: z
    .string()
    .min(1, "A prompt describing the homepage is required")
    .max(4000, "Prompt is too long"),
  title: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  tools: z
    .array(z.string().min(1))
    .max(12, "Limit homepage plans to at most 12 tools")
    .optional()
    .transform((tools) =>
      tools?.map((tool) => tool.trim()).filter(Boolean)
    ),
  sections: z.array(homepageSectionSchema).optional(),
  notes: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
});

const saveHomepageInputSchema = {
  type: "object",
  properties: {
    prompt: {
      type: "string",
      description:
        "The exact instruction the assistant should replay to reconstruct the saved financial homepage.",
    },
    title: {
      type: "string",
      description: "Optional descriptive title for the saved homepage.",
    },
    tools: {
      type: "array",
      description: "Optional ordered list of tool names the assistant should call when replaying the homepage.",
      items: { type: "string" },
      maxItems: 12,
    },
    sections: {
      type: "array",
      description: "Optional layout hints for the homepage.",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          widget: { type: "string" },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
    notes: {
      type: "string",
      description: "Optional internal notes about how this homepage should be used.",
    },
  },
  required: ["prompt"],
  additionalProperties: false,
} as const;

export function getSaveFinancialHomepageTool(): ToolDefinition {
  return {
    name: "save-financial-homepage",
    description:
      "Demo placeholder: accept a prompt describing the Financial Home layout so the assistant can pretend to save it.",
    inputSchema: saveHomepageInputSchema,
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

      const parsed = saveHomepageSchema.parse(args);
      const normalizedPrompt = parsed.prompt.trim();
      if (!normalizedPrompt) {
        throw new Error("Prompt is required to save a financial homepage.");
      }

      // No persistence in the demo flow—we simply acknowledge receipt.

      return {
        content: [
          {
            type: "text" as const,
            text: "**Saved Financial Home (Demo)**\n\nYour financial homepage prompt is noted.",
          },
        ],
        structuredContent: {
          homepage: {
            status: "saved",
            title: parsed.title || null,
            hasPrompt: true,
            toolsCaptured: parsed.tools?.length ?? 0,
            sectionsCaptured: parsed.sections?.length ?? 0,
          },
        },
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
          "Show me my accounts, and show me a bar chart 30 day summary of my transactions grouped by category";

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
