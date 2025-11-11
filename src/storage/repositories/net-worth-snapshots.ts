import { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRole } from "../supabase.js";
import { Database } from "../database.types.js";

export interface NetWorthSnapshot {
  id: string;
  user_id: string;
  snapshot_date: string;
  net_worth_amount: number;
  assets_total: number;
  liabilities_total: number;
  created_at: string | null;
  updated_at: string | null;
}

type SnapshotInsert = Omit<NetWorthSnapshot, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

function getClient(supabaseClient?: SupabaseClient<Database>) {
  return supabaseClient ?? getSupabaseServiceRole();
}

/**
 * Fetch the most recent net worth snapshots for a user (ordered newest → oldest).
 */
export async function getRecentNetWorthSnapshots(
  userId: string,
  options: { limit?: number; beforeDate?: string } = {},
  supabaseClient?: SupabaseClient<Database>
): Promise<NetWorthSnapshot[]> {
  const client = getClient(supabaseClient);

  let query = client
    .from("net_worth_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("snapshot_date", { ascending: false });

  if (options.beforeDate) {
    query = query.lt("snapshot_date", options.beforeDate);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch net worth snapshots: ${error.message}`);
  }

  return (data as NetWorthSnapshot[]) ?? [];
}

/**
 * Upsert a net worth snapshot for a user. Used by cron/account sync jobs.
 */
export async function upsertNetWorthSnapshot(
  snapshot: SnapshotInsert,
  supabaseClient?: SupabaseClient<Database>
): Promise<NetWorthSnapshot> {
  const client = getClient(supabaseClient);

  const { data, error } = await client
    .from("net_worth_snapshots")
    .upsert(
      {
        ...snapshot,
      },
      { onConflict: "user_id,snapshot_date" }
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert net worth snapshot: ${error.message}`);
  }

  return data as NetWorthSnapshot;
}
