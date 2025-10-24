import { z } from "zod";
import type { ToolDefinition } from "../types.js";
import {
  getDemoHomepage,
  saveDemoHomepage,
  DemoHomepageSection,
} from "../../storage/demo/homepage.js";
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

export function getSaveFinancialHomepageTool(): ToolDefinition {
  return {
    name: "save-financial-homepage",
    description:
      "Persist a reusable 'Financial Home' prompt so the assistant can rebuild the user's preferred dashboard layout on demand.",
    inputSchema: saveHomepageSchema,
    options: {
      securitySchemes: [{ type: "oauth2" }],
    },
    handler: async (args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;
      if (!userId) {
        throw new Error("User authentication required");
      }

      const parsed = saveHomepageSchema.parse(args);
      const record = saveDemoHomepage(userId, {
        prompt: parsed.prompt,
        title: parsed.title,
        tools: parsed.tools,
        sections: parsed.sections as DemoHomepageSection[] | undefined,
        notes: parsed.notes,
      });

      const confirmationLines = [
        `**Saved Financial Home: ${record.title}**`,
        "",
        `• Prompt stored (${record.prompt.length} characters)`,
        `• Tool plan: ${record.tools.length > 0 ? record.tools.join(", ") : "add tools later"}`,
        `• Sections: ${record.sections.length}`,
      ];
      if (record.notes) {
        confirmationLines.push(`• Notes: ${record.notes}`);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: confirmationLines.join("\n"),
          },
        ],
        structuredContent: {
          homepage: record,
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
        const record = getDemoHomepage(userId);
        if (!record) {
          return {
            content: [
              {
                type: "text" as const,
                text:
                  "No Financial Home is saved yet. Call `save-financial-homepage` with a prompt and tool plan to create one.",
              },
            ],
            structuredContent: {
              homepage: null,
            },
          };
        }

        const recap = [
          `**${record.title}**`,
          "",
          record.prompt,
          "",
          `Saved ${new Date(record.updatedAt).toLocaleString()}`,
        ];

        if (record.tools.length > 0) {
          recap.push("", "**Recommended tools to run**");
          record.tools.forEach((tool) => {
            recap.push(`• ${tool}`);
          });
        }

        if (record.sections.length > 0) {
          recap.push("", "**Layout**");
          record.sections.forEach((section) => {
            recap.push(`• ${section.title}${section.widget ? ` (${section.widget})` : ""}`);
            if (section.description) {
              recap.push(`  ${section.description}`);
            }
          });
        }

        return {
          content: [
            {
              type: "text" as const,
              text: recap.join("\n"),
            },
          ],
          structuredContent: {
            homepage: record,
            callPlan:
              record.tools.length > 0
                ? record.tools.map((toolName, index) => ({
                    order: index + 1,
                    tool: toolName,
                  }))
                : [],
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
