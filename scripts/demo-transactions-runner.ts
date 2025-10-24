import { buildDemoTransactionSeedData } from "../src/demo-data/transactions.js";
import {
  deleteDemoTransactions,
  getDemoTransactions,
  upsertDemoTransactions,
} from "../src/storage/demo/transactions.js";
import { logServiceEvent, serializeError } from "../src/utils/logger.js";

export interface DemoTransactionsSeedOptions {
  reset?: boolean;
}

export async function runDemoTransactionsSeed(
  userId: string,
  options: DemoTransactionsSeedOptions = {}
) {
  const resetFirst = options.reset !== false;
  const seedData = buildDemoTransactionSeedData(userId);

  try {
    if (resetFirst) {
      await deleteDemoTransactions(userId);
    }

    await upsertDemoTransactions(seedData);

    const snapshot = await getDemoTransactions(userId, {
      startDate: undefined,
      endDate: undefined,
      limit: 200,
    });

    logServiceEvent("demo-transactions", "seed-complete", {
      userId,
      reset: resetFirst,
      transactionCount: snapshot.transactions.length,
      spendingTotal: snapshot.spendingTotal,
      categories: snapshot.categoryTotals.length,
    });

    return snapshot;
  } catch (error) {
    logServiceEvent(
      "demo-transactions",
      "seed-error",
      { userId, error: serializeError(error) },
      "error"
    );
    throw error;
  }
}
