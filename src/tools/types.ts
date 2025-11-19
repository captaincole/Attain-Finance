import type { PlaidApi } from "plaid";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../storage/database.types.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  outputSchema?: any;
  options: any;
  handler: ToolHandler;
}

export interface ToolHandlerDependencies {
  plaidClient?: PlaidApi;
  supabaseClient?: SupabaseClient<Database>;
}

export type ToolHandler<Args = any> = (
  args: Args,
  context: any,
  deps: ToolHandlerDependencies
) => Promise<any>;
