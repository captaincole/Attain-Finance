/**
 * Standardized error handling for MCP tools
 */
import { createTextResponse, type ToolResponse } from "./responses.js";

export class ToolError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage?: string
  ) {
    super(message);
    this.name = "ToolError";
  }
}

export function handleToolError(error: any): ToolResponse {
  console.error("Tool error:", error);

  if (error instanceof ToolError) {
    return createTextResponse(
      error.userMessage || `Error: ${error.message}`
    );
  }

  return createTextResponse(
    "An unexpected error occurred. Please try again later."
  );
}
