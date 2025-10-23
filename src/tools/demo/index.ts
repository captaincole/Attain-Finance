import type { ToolDefinition } from "../types.js";
import { getInvestmentsTool } from "./investments.js";
import { getDebtOverviewTool, getCreditScoreTool } from "./liabilities.js";

export function getDemoTools(): ToolDefinition[] {
  return [getInvestmentsTool(), getDebtOverviewTool(), getCreditScoreTool()];
}
