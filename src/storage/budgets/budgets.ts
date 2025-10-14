import { getSupabase } from "../supabase.js";
import { Tables, TablesInsert, TablesUpdate } from "../database.types.js";

export type Budget = Tables<"budgets">;
export type BudgetInsert = TablesInsert<"budgets">;
export type BudgetUpdate = TablesUpdate<"budgets">;

/**
 * Get all budgets for a user
 */
export async function getBudgets(userId: string): Promise<Budget[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
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
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("user_id", userId)
    .eq("id", budgetId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // Not found
      return null;
    }
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
}
