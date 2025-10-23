import { buildDemoLiabilitySeedData } from "../src/demo-data/liabilities.js";
import {
  deleteDemoLiabilityData,
  getDemoLiabilitySnapshot,
  upsertDemoLiabilityData,
} from "../src/storage/demo/liabilities.js";
import { logServiceEvent, serializeError } from "../src/utils/logger.js";

export interface DemoLiabilitySeedOptions {
  reset?: boolean;
}

export async function runDemoLiabilitySeed(
  userId: string,
  options: DemoLiabilitySeedOptions = {}
) {
  const resetFirst = options.reset !== false;
  const seedData = buildDemoLiabilitySeedData(userId);

  try {
    if (resetFirst) {
      await deleteDemoLiabilityData(userId);
    }

    await upsertDemoLiabilityData(seedData);

    const snapshot = await getDemoLiabilitySnapshot(userId);

    logServiceEvent("demo-liabilities", "seed-complete", {
      userId,
      reset: resetFirst,
      accountCount: snapshot.accounts.length,
      totalBalance: snapshot.totals.totalBalance,
      minimumPayment: snapshot.totals.totalMinimumPayment,
    });

    return snapshot;
  } catch (error) {
    logServiceEvent(
      "demo-liabilities",
      "seed-error",
      { userId, error: serializeError(error) },
      "error"
    );
    throw error;
  }
}
