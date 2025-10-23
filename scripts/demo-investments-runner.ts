import { buildDemoInvestmentSeedData } from "../src/demo-data/investments.js";
import {
  deleteDemoInvestmentData,
  getDemoInvestmentSnapshot,
  upsertDemoInvestmentData,
} from "../src/storage/demo/investments.js";
import { logServiceEvent, serializeError } from "../src/utils/logger.js";

export interface DemoInvestmentSeedOptions {
  reset?: boolean;
}

export async function runDemoInvestmentSeed(
  userId: string,
  options: DemoInvestmentSeedOptions = {}
) {
  const resetFirst = options.reset !== false;
  const seedData = buildDemoInvestmentSeedData(userId);
  const securityIds = seedData.securities.map((security) => security.security_id);

  try {
    if (resetFirst) {
      await deleteDemoInvestmentData(userId, securityIds);
    }

    await upsertDemoInvestmentData(seedData);

    const snapshot = await getDemoInvestmentSnapshot(userId);

    logServiceEvent("demo-investments", "seed-complete", {
      userId,
      reset: resetFirst,
      accountCount: snapshot.accounts.length,
      holdingCount: snapshot.holdings.length,
      securityCount: snapshot.securities.length,
      totalValue: snapshot.totals.totalValue,
    });

    return snapshot;
  } catch (error) {
    logServiceEvent(
      "demo-investments",
      "seed-error",
      { userId, error: serializeError(error) },
      "error"
    );
    throw error;
  }
}
