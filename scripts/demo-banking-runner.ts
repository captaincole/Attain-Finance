import { buildDemoBankSeedData } from "../src/demo-data/banking.js";
import {
  deleteDemoBankData,
  getDemoBankSnapshot,
  upsertDemoBankData,
} from "../src/storage/demo/banking.js";
import { logServiceEvent, serializeError } from "../src/utils/logger.js";

export interface DemoBankSeedOptions {
  reset?: boolean;
}

export async function runDemoBankSeed(
  userId: string,
  options: DemoBankSeedOptions = {}
) {
  const resetFirst = options.reset !== false;
  const seedData = buildDemoBankSeedData(userId);

  try {
    if (resetFirst) {
      await deleteDemoBankData(userId);
    }

    await upsertDemoBankData(seedData);

    const snapshot = await getDemoBankSnapshot(userId);

    logServiceEvent("demo-banking", "seed-complete", {
      userId,
      reset: resetFirst,
      balance: snapshot?.account.balances_current,
      transactionCount: snapshot?.transactions.length || 0,
    });

    return snapshot;
  } catch (error) {
    logServiceEvent(
      "demo-banking",
      "seed-error",
      { userId, error: serializeError(error) },
      "error"
    );
    throw error;
  }
}
