/**
 * Standardized response helpers for MCP tools
 */

export interface ToolResponse {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: any;
  _meta?: Record<string, any>;
}

export function createTextResponse(text: string): ToolResponse {
  return {
    content: [{ type: "text" as const, text }],
  };
}

export function createWidgetResponse(
  text: string,
  structuredContent: any,
  widgetUri: string
): ToolResponse {
  return {
    content: [{ type: "text" as const, text }],
    structuredContent,
    _meta: {
      "openai/outputTemplate": widgetUri,
      "openai/widgetAccessible": true,
      "openai/resultCanProduceWidget": true,
    },
  };
}
