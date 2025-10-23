import type { ToolDefinition } from "../types.js";
import { getInvestmentsTool } from "./investments.js";

export function getDemoTools(): ToolDefinition[] {
  return [getInvestmentsTool()];
}
