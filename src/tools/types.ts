import type { PlaidApi } from "plaid";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  options: any;
  handler: ToolHandler;
}

export interface ToolHandlerDependencies {
  plaidClient?: PlaidApi;
}

export type ToolHandler<Args = any> = (
  args: Args,
  context: any,
  deps: ToolHandlerDependencies
) => Promise<any>;
