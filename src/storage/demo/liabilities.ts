import { getSupabase } from "../supabase.js";
import {
  Tables,
  TablesInsert,
  TablesUpdate,
} from "../database.types.js";
import { logServiceEvent, serializeError } from "../../utils/logger.js";

export type DemoLiabilityAccount = Tables<"demo_liability_accounts">;
export type DemoLiabilityDetail = Tables<"demo_liability_details">;
export type DemoCreditScore = Tables<"demo_credit_scores">;

export type DemoLiabilityAccountInsert =
  TablesInsert<"demo_liability_accounts">;
export type DemoLiabilityDetailInsert =
  TablesInsert<"demo_liability_details">;
export type DemoCreditScoreInsert = TablesInsert<"demo_credit_scores">;

export type DemoLiabilityAccountUpdate =
  TablesUpdate<"demo_liability_accounts">;
export type DemoLiabilityDetailUpdate =
  TablesUpdate<"demo_liability_details">;
export type DemoCreditScoreUpdate = TablesUpdate<"demo_credit_scores">;

export interface DemoLiabilitySeedData {
  accounts: DemoLiabilityAccountInsert[];
  details: DemoLiabilityDetailInsert[];
  creditScore?: DemoCreditScoreInsert | null;
}

export interface DemoLiabilitySnapshot {
  accounts: DemoLiabilityAccount[];
  details: DemoLiabilityDetail[];
  creditScore: DemoCreditScore | null;
  totals: {
    totalBalance: number;
    totalMinimumPayment: number;
    totalPastDue: number;
  };
  debtsByType: Record<
    string,
    {
      totalBalance: number;
      minimumPayment: number;
      accounts: DemoLiabilityDetail[];
    }
  >;
}

function ensureNumber(value?: number | null): number {
  return typeof value === "number" ? value : 0;
}

export async function deleteDemoLiabilityData(userId: string): Promise<void> {
  const supabase = getSupabase();

  const detailsResult = await supabase
    .from("demo_liability_details")
    .delete()
    .eq("user_id", userId);

  if (detailsResult.error) {
    logServiceEvent(
      "demo-liabilities",
      "delete-details-error",
      { userId, error: serializeError(detailsResult.error) },
      "error"
    );
    throw new Error(
      `Failed to delete demo liability details: ${detailsResult.error.message}`
    );
  }

  const accountsResult = await supabase
    .from("demo_liability_accounts")
    .delete()
    .eq("user_id", userId);

  if (accountsResult.error) {
    logServiceEvent(
      "demo-liabilities",
      "delete-accounts-error",
      { userId, error: serializeError(accountsResult.error) },
      "error"
    );
    throw new Error(
      `Failed to delete demo liability accounts: ${accountsResult.error.message}`
    );
  }

  const creditScoreResult = await supabase
    .from("demo_credit_scores")
    .delete()
    .eq("user_id", userId);

  if (creditScoreResult.error) {
    logServiceEvent(
      "demo-liabilities",
      "delete-credit-score-error",
      { userId, error: serializeError(creditScoreResult.error) },
      "error"
    );
    throw new Error(
      `Failed to delete demo credit score: ${creditScoreResult.error.message}`
    );
  }
}

export async function upsertDemoLiabilityData(
  data: DemoLiabilitySeedData
): Promise<void> {
  const supabase = getSupabase();

  if (data.accounts.length > 0) {
    const { error } = await supabase
      .from("demo_liability_accounts")
      .upsert(data.accounts, { onConflict: "account_id" });

    if (error) {
      logServiceEvent(
        "demo-liabilities",
        "upsert-accounts-error",
        { error: serializeError(error) },
        "error"
      );
      throw new Error(`Failed to upsert demo liability accounts: ${error.message}`);
    }
  }

  if (data.details.length > 0) {
    const { error } = await supabase
      .from("demo_liability_details")
      .insert(data.details);

    if (error) {
      logServiceEvent(
        "demo-liabilities",
        "insert-details-error",
        { error: serializeError(error) },
        "error"
      );
      throw new Error(`Failed to insert demo liability details: ${error.message}`);
    }
  }

  if (data.creditScore) {
    const { error } = await supabase
      .from("demo_credit_scores")
      .upsert(data.creditScore, { onConflict: "user_id" });

    if (error) {
      logServiceEvent(
        "demo-liabilities",
        "upsert-credit-score-error",
        { error: serializeError(error) },
        "error"
      );
      throw new Error(`Failed to upsert demo credit score: ${error.message}`);
    }
  }
}

export async function getDemoLiabilitySnapshot(
  userId: string
): Promise<DemoLiabilitySnapshot> {
  const supabase = getSupabase();

  const { data: accounts, error: accountError } = await supabase
    .from("demo_liability_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (accountError) {
    logServiceEvent(
      "demo-liabilities",
      "fetch-accounts-error",
      { userId, error: serializeError(accountError) },
      "error"
    );
    throw new Error(`Failed to fetch demo liability accounts: ${accountError.message}`);
  }

  const { data: details, error: detailError } = await supabase
    .from("demo_liability_details")
    .select("*")
    .eq("user_id", userId);

  if (detailError) {
    logServiceEvent(
      "demo-liabilities",
      "fetch-details-error",
      { userId, error: serializeError(detailError) },
      "error"
    );
    throw new Error(`Failed to fetch demo liability details: ${detailError.message}`);
  }

  const { data: creditScoreRow, error: creditError } = await supabase
    .from("demo_credit_scores")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (creditError) {
    logServiceEvent(
      "demo-liabilities",
      "fetch-credit-score-error",
      { userId, error: serializeError(creditError) },
      "error"
    );
    throw new Error(`Failed to fetch demo credit score: ${creditError.message}`);
  }

  const totals = (details || []).reduce(
    (acc, detail) => {
      acc.totalBalance += ensureNumber(detail.outstanding_principal_amount);
      acc.totalMinimumPayment += ensureNumber(detail.minimum_payment_amount);
      acc.totalPastDue += ensureNumber(detail.past_due_amount);
      return acc;
    },
    {
      totalBalance: 0,
      totalMinimumPayment: 0,
      totalPastDue: 0,
    }
  );

  const debtsByType: DemoLiabilitySnapshot["debtsByType"] = {};

  (details || []).forEach((detail) => {
    const type = detail.liability_type;
    if (!debtsByType[type]) {
      debtsByType[type] = {
        totalBalance: 0,
        minimumPayment: 0,
        accounts: [],
      };
    }

    debtsByType[type].totalBalance += ensureNumber(
      detail.outstanding_principal_amount
    );
    debtsByType[type].minimumPayment += ensureNumber(
      detail.minimum_payment_amount
    );
    debtsByType[type].accounts.push(detail);
  });

  return {
    accounts: accounts || [],
    details: details || [],
    creditScore: creditScoreRow || null,
    totals,
    debtsByType,
  };
}
