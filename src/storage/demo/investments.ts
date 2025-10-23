import { getSupabase } from "../supabase.js";
import {
  Tables,
  TablesInsert,
  TablesUpdate,
} from "../database.types.js";
import { logServiceEvent, serializeError } from "../../utils/logger.js";

export type DemoInvestmentAccount = Tables<"demo_investment_accounts">;
export type DemoInvestmentSecurity = Tables<"demo_investment_securities">;
export type DemoInvestmentHolding = Tables<"demo_investment_holdings">;

export type DemoInvestmentAccountInsert =
  TablesInsert<"demo_investment_accounts">;
export type DemoInvestmentSecurityInsert =
  TablesInsert<"demo_investment_securities">;
export type DemoInvestmentHoldingInsert =
  TablesInsert<"demo_investment_holdings">;

export type DemoInvestmentAccountUpdate =
  TablesUpdate<"demo_investment_accounts">;
export type DemoInvestmentSecurityUpdate =
  TablesUpdate<"demo_investment_securities">;
export type DemoInvestmentHoldingUpdate =
  TablesUpdate<"demo_investment_holdings">;

export interface DemoInvestmentSeedData {
  accounts: DemoInvestmentAccountInsert[];
  securities: DemoInvestmentSecurityInsert[];
  holdings: DemoInvestmentHoldingInsert[];
}

export interface DemoInvestmentSnapshot {
  accounts: DemoInvestmentAccount[];
  holdings: Array<DemoInvestmentHolding & { institution_value: number }>;
  securities: DemoInvestmentSecurity[];
  totals: {
    totalValue: number;
    totalCash: number;
    totalInvested: number;
  };
}

function ensureNumber(value: number | null | undefined): number {
  return typeof value === "number" ? value : 0;
}

function isMissingTableError(error: any): boolean {
  const message =
    (typeof error?.message === "string" && error.message) ||
    (typeof error?.hint === "string" && error.hint) ||
    (typeof error === "string" ? error : "");

  return typeof message === "string" && message.includes("Could not find the table");
}

function calculateHoldingValue(holding: DemoInvestmentHolding): number {
  if (typeof holding.institution_value === "number") {
    return holding.institution_value;
  }
  if (
    typeof holding.institution_price === "number" &&
    typeof holding.quantity === "number"
  ) {
    return holding.institution_price * holding.quantity;
  }
  return 0;
}

/**
 * Delete demo investment data for a user.
 * Securities are optional because they may be shared across users.
 */
export async function deleteDemoInvestmentData(
  userId: string,
  securityIds?: string[]
): Promise<void> {
  const supabase = getSupabase();

  const holdingsResult = await supabase
    .from("demo_investment_holdings")
    .delete()
    .eq("user_id", userId);

  if (holdingsResult.error) {
    logServiceEvent(
      "demo-investments",
      "delete-holdings-error",
      { userId, error: serializeError(holdingsResult.error) },
      "error"
    );

    if (isMissingTableError(holdingsResult.error)) {
      throw new Error(
        "Demo investment tables not found. Run the latest Supabase migrations before seeding demo data."
      );
    }

    throw new Error(
      `Failed to delete demo investment holdings: ${holdingsResult.error.message}`
    );
  }

  const accountsResult = await supabase
    .from("demo_investment_accounts")
    .delete()
    .eq("user_id", userId);

  if (accountsResult.error) {
    logServiceEvent(
      "demo-investments",
      "delete-accounts-error",
      { userId, error: serializeError(accountsResult.error) },
      "error"
    );

    if (isMissingTableError(accountsResult.error)) {
      throw new Error(
        "Demo investment tables not found. Run the latest Supabase migrations before seeding demo data."
      );
    }

    throw new Error(
      `Failed to delete demo investment accounts: ${accountsResult.error.message}`
    );
  }

  if (securityIds && securityIds.length > 0) {
    const securitiesResult = await supabase
      .from("demo_investment_securities")
      .delete()
      .in("security_id", securityIds);

    if (securitiesResult.error) {
      logServiceEvent(
        "demo-investments",
        "delete-securities-error",
        {
          userId,
          securityIds,
          error: serializeError(securitiesResult.error),
        },
        "warn"
      );
      // Do not throw here—securities can be shared across users
    }
  }
}

/**
 * Upsert demo investment seed data for a user.
 * Expects tables to already be cleared with deleteDemoInvestmentData.
 */
export async function upsertDemoInvestmentData(
  data: DemoInvestmentSeedData
): Promise<void> {
  const supabase = getSupabase();

  if (data.securities.length > 0) {
    const { error } = await supabase
      .from("demo_investment_securities")
      .upsert(data.securities, { onConflict: "security_id" });

    if (error) {
      logServiceEvent(
        "demo-investments",
        "upsert-securities-error",
        { error: serializeError(error) },
        "error"
      );

      if (isMissingTableError(error)) {
        throw new Error(
          "Demo investment tables not found. Run the latest Supabase migrations before seeding demo data."
        );
      }

      throw new Error(`Failed to upsert demo securities: ${error.message}`);
    }
  }

  if (data.accounts.length > 0) {
    const { error } = await supabase
      .from("demo_investment_accounts")
      .upsert(data.accounts, { onConflict: "account_id" });

    if (error) {
      logServiceEvent(
        "demo-investments",
        "upsert-accounts-error",
        { error: serializeError(error) },
        "error"
      );

      if (isMissingTableError(error)) {
        throw new Error(
          "Demo investment tables not found. Run the latest Supabase migrations before seeding demo data."
        );
      }

      throw new Error(`Failed to upsert demo accounts: ${error.message}`);
    }
  }

  if (data.holdings.length > 0) {
    const { error } = await supabase
      .from("demo_investment_holdings")
      .insert(data.holdings);

    if (error) {
      logServiceEvent(
        "demo-investments",
        "insert-holdings-error",
        { error: serializeError(error) },
        "error"
      );

      if (isMissingTableError(error)) {
        throw new Error(
          "Demo investment tables not found. Run the latest Supabase migrations before seeding demo data."
        );
      }

      throw new Error(`Failed to insert demo holdings: ${error.message}`);
    }
  }
}

/**
 * Fetch a Plaid-shaped snapshot of demo investment data for a user.
 */
export async function getDemoInvestmentSnapshot(
  userId: string
): Promise<DemoInvestmentSnapshot> {
  const supabase = getSupabase();

  const { data: accounts, error: accountError } = await supabase
    .from("demo_investment_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("name", { ascending: true });

  if (accountError) {
    logServiceEvent(
      "demo-investments",
      "fetch-accounts-error",
      { userId, error: serializeError(accountError) },
      "error"
    );
    throw new Error(`Failed to fetch demo investment accounts: ${accountError.message}`);
  }

  const { data: holdings, error: holdingError } = await supabase
    .from("demo_investment_holdings")
    .select("*")
    .eq("user_id", userId);

  if (holdingError) {
    logServiceEvent(
      "demo-investments",
      "fetch-holdings-error",
      { userId, error: serializeError(holdingError) },
      "error"
    );
    throw new Error(`Failed to fetch demo investment holdings: ${holdingError.message}`);
  }

  const securityIds = Array.from(
    new Set((holdings ?? []).map((holding) => holding.security_id))
  );

  let securities: DemoInvestmentSecurity[] = [];

  if (securityIds.length > 0) {
    const { data: securityData, error: securityError } = await supabase
      .from("demo_investment_securities")
      .select("*")
      .in("security_id", securityIds);

    if (securityError) {
      logServiceEvent(
        "demo-investments",
        "fetch-securities-error",
        { userId, error: serializeError(securityError) },
        "error"
      );
      throw new Error(`Failed to fetch demo investment securities: ${securityError.message}`);
    }

    securities = securityData || [];
  }

  const holdingsWithValue = (holdings || []).map((holding) => ({
    ...holding,
    institution_value: calculateHoldingValue(holding),
  }));

  const cashSecurities = new Set(
    securities
      .filter((security) => security.is_cash_equivalent || security.type === "cash")
      .map((security) => security.security_id)
  );

  const totalValue = holdingsWithValue.reduce(
    (sum, holding) => sum + holding.institution_value,
    0
  );

  const totalCash = holdingsWithValue
    .filter((holding) => cashSecurities.has(holding.security_id))
    .reduce((sum, holding) => sum + holding.institution_value, 0);

  const totalAccountCash = (accounts || []).reduce(
    (sum, account) => sum + ensureNumber(account.balances_available ?? account.balances_current),
    0
  );

  const totalInvested = totalValue - totalCash;

  return {
    accounts: accounts || [],
    holdings: holdingsWithValue,
    securities,
    totals: {
      totalValue: totalValue + totalAccountCash,
      totalCash: totalCash + totalAccountCash,
      totalInvested,
    },
  };
}
