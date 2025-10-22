import { getSupabase } from "../supabase.js";
import { Tables, TablesInsert, TablesUpdate } from "../database.types.js";
import { logServiceEvent, serializeError } from "../../utils/logger.js";

export type Budget = Tables<"budgets">;
export type BudgetInsert = TablesInsert<"budgets">;
export type BudgetUpdate = TablesUpdate<"budgets">;

/**
 * Get all budgets for a user
 */
export async function getBudgets(userId: string): Promise<Budget[]> {
  let supabase;
  try {
    supabase = getSupabase();
  } catch (err: any) {
    logServiceEvent("budgets-repository", "supabase-client-error", { userId, error: serializeError(err) }, "error");
    throw err;
  }

  let data, error;
  try {
    const result = await supabase
      .from("budgets")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    data = result.data;
    error = result.error;
  } catch (err: any) {
    logServiceEvent("budgets-repository", "query-exception", { userId, error: serializeError(err) }, "error");
    throw err;
  }

  if (error) {
    logServiceEvent("budgets-repository", "query-error", { userId, error: serializeError(error) }, "error");
    throw new Error(`Failed to fetch budgets: ${error.message}`);
  }

  return data || [];
}

/**
 * Get a single budget by ID
 */
export async function getBudgetById(
  userId: string,
  budgetId: string
): Promise<Budget | null> {
  let supabase;
  try {
    supabase = getSupabase();
  } catch (err: any) {
    logServiceEvent("budgets-repository", "supabase-client-error", { userId, budgetId, error: serializeError(err) }, "error");
    throw err;
  }

  let data, error;
  try {
    const result = await supabase
      .from("budgets")
      .select("*")
      .eq("user_id", userId)
      .eq("id", budgetId)
      .single();

    data = result.data;
    error = result.error;
  } catch (err: any) {
    logServiceEvent("budgets-repository", "query-exception", { userId, budgetId, error: serializeError(err) }, "error");
    throw err;
  }

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    logServiceEvent("budgets-repository", "query-error", { userId, budgetId, error: serializeError(error) }, "error");
    throw new Error(`Failed to fetch budget: ${error.message}`);
  }

  return data;
}

/**
 * Create a new budget
 */
export async function createBudget(budget: BudgetInsert): Promise<Budget> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("budgets")
    .insert(budget)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create budget: ${error.message}`);
  }

  return data;
}

/**
 * Update an existing budget
 */
export async function updateBudget(
  userId: string,
  budgetId: string,
  updates: Omit<BudgetUpdate, "id" | "user_id">
): Promise<Budget> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("budgets")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", budgetId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update budget: ${error.message}`);
  }

  return data;
}

/**
 * Delete a budget
 */
export async function deleteBudget(
  userId: string,
  budgetId: string
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("budgets")
    .delete()
    .eq("user_id", userId)
    .eq("id", budgetId);

  if (error) {
    throw new Error(`Failed to delete budget: ${error.message}`);
  }

  logServiceEvent("budgets-repository", "budget-deleted", { userId, budgetId });
}

/**
 * Update budget processing status to "processing"
 */
export async function markBudgetAsProcessing(
  budgetId: string
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("budgets")
    .update({
      processing_status: "processing",
      processing_completed_at: null,
      processing_error: null,
    })
    .eq("id", budgetId);

  if (error) {
    throw new Error(`Failed to mark budget as processing: ${error.message}`);
  }

  logServiceEvent("budgets-repository", "budget-processing", { budgetId });
}

/**
 * Update budget processing status to "ready" (success)
 */
export async function markBudgetAsReady(
  budgetId: string
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("budgets")
    .update({
      processing_status: "ready",
      processing_completed_at: new Date().toISOString(),
      processing_error: null,
    })
    .eq("id", budgetId);

  if (error) {
    throw new Error(`Failed to mark budget as ready: ${error.message}`);
  }

  logServiceEvent("budgets-repository", "budget-ready", { budgetId });
}

/**
 * Update budget processing status to "error"
 */
export async function markBudgetAsError(
  budgetId: string,
  errorMessage: string
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("budgets")
    .update({
      processing_status: "error",
      processing_completed_at: new Date().toISOString(),
      processing_error: errorMessage,
    })
    .eq("id", budgetId);

  if (error) {
    throw new Error(`Failed to mark budget as error: ${error.message}`);
  }

  logServiceEvent("budgets-repository", "budget-error", { budgetId, errorMessage }, "warn");
}
