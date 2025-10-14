import { getSupabase } from "../supabase.js";
import { Tables, TablesInsert, TablesUpdate } from "../database.types.js";

export type Budget = Tables<"budgets">;
export type BudgetInsert = TablesInsert<"budgets">;
export type BudgetUpdate = TablesUpdate<"budgets">;

/**
 * Get all budgets for a user
 */
export async function getBudgets(userId: string): Promise<Budget[]> {
  console.log("[REPO/BUDGETS] getBudgets called for user:", userId);

  let supabase;
  try {
    supabase = getSupabase();
    console.log("[REPO/BUDGETS] Got supabase client:", !!supabase);
  } catch (err: any) {
    console.error("[REPO/BUDGETS] Error getting supabase client:", err);
    throw err;
  }

  let data, error;
  try {
    console.log("[REPO/BUDGETS] Starting query...");
    const result = await supabase
      .from("budgets")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    data = result.data;
    error = result.error;
    console.log("[REPO/BUDGETS] Query completed. Error:", !!error, "Data count:", data?.length);
  } catch (err: any) {
    console.error("[REPO/BUDGETS] Exception during query:", err);
    console.error("[REPO/BUDGETS] Exception stack:", err.stack);
    throw err;
  }

  if (error) {
    console.error("[REPO/BUDGETS] Query error:", error);
    throw new Error(`Failed to fetch budgets: ${error.message}`);
  }

  console.log("[REPO/BUDGETS] Returning", data?.length || 0, "budgets");
  return data || [];
}

/**
 * Get a single budget by ID
 */
export async function getBudgetById(
  userId: string,
  budgetId: string
): Promise<Budget | null> {
  console.log("[REPO/BUDGETS] getBudgetById called for user:", userId, "budget:", budgetId);

  let supabase;
  try {
    supabase = getSupabase();
    console.log("[REPO/BUDGETS] Got supabase client:", !!supabase);
  } catch (err: any) {
    console.error("[REPO/BUDGETS] Error getting supabase client:", err);
    throw err;
  }

  let data, error;
  try {
    console.log("[REPO/BUDGETS] Starting single budget query...");
    const result = await supabase
      .from("budgets")
      .select("*")
      .eq("user_id", userId)
      .eq("id", budgetId)
      .single();

    data = result.data;
    error = result.error;
    console.log("[REPO/BUDGETS] Single query completed. Error:", !!error, "Found:", !!data);
  } catch (err: any) {
    console.error("[REPO/BUDGETS] Exception during single query:", err);
    console.error("[REPO/BUDGETS] Exception stack:", err.stack);
    throw err;
  }

  if (error) {
    if (error.code === "PGRST116") {
      console.log("[REPO/BUDGETS] Budget not found (404)");
      return null;
    }
    console.error("[REPO/BUDGETS] Query error:", error);
    throw new Error(`Failed to fetch budget: ${error.message}`);
  }

  console.log("[REPO/BUDGETS] Returning budget:", data?.id);
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
