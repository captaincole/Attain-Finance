/**
 * Budget Date Range Calculation Unit Tests
 *
 * Tests the date range calculation logic for different budget periods.
 * This helps debug issues where transactions are labeled but show $0 spent
 * due to date range filtering.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

/**
 * Calculate date range for budget period
 * This is extracted from src/tools/budgets/get-budgets.ts:24-118
 */
function getBudgetDateRange(
  timePeriod: string,
  customPeriodDays?: number | null,
  fixedPeriodStartDate?: string | null,
  currentDate: Date = new Date() // Allow injecting test date
): { start: Date; end: Date } {
  const now = currentDate;
  const end = new Date(now); // Today

  // ROLLING BUDGETS: Last N days (continuously rolling window)
  if (timePeriod === "rolling") {
    if (!customPeriodDays) {
      throw new Error("custom_period_days required for rolling budgets");
    }
    const start = new Date(now);
    start.setDate(start.getDate() - customPeriodDays);
    start.setUTCHours(0, 0, 0, 0);
    return { start, end };
  }

  // FIXED BUDGETS: Calendar-based with anchor date
  if (!fixedPeriodStartDate) {
    throw new Error("fixed_period_start_date required for fixed budgets");
  }

  // Parse anchor date in UTC to avoid timezone shifts
  const [year, month, day] = fixedPeriodStartDate.split("-").map(Number);
  const anchorDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  switch (timePeriod) {
    case "weekly": {
      const start = new Date(anchorDate);
      const daysSinceAnchor = Math.floor((now.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
      const periodsPassed = Math.floor(daysSinceAnchor / 7);
      start.setUTCDate(start.getUTCDate() + periodsPassed * 7);
      start.setUTCHours(0, 0, 0, 0);
      return { start, end };
    }

    case "biweekly": {
      const start = new Date(anchorDate);
      const daysSinceAnchor = Math.floor((now.getTime() - anchorDate.getTime()) / (1000 * 60 * 60 * 24));
      const periodsPassed = Math.floor(daysSinceAnchor / 14);
      start.setUTCDate(start.getUTCDate() + periodsPassed * 14);
      start.setUTCHours(0, 0, 0, 0);
      return { start, end };
    }

    case "monthly": {
      const anchorDay = anchorDate.getUTCDate();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), anchorDay, 0, 0, 0, 0));

      if (start > now) {
        start.setUTCMonth(start.getUTCMonth() - 1);
      }

      start.setUTCHours(0, 0, 0, 0);
      return { start, end };
    }

    case "quarterly": {
      const start = new Date(anchorDate);
      const monthsSinceAnchor = (now.getUTCFullYear() - anchorDate.getUTCFullYear()) * 12 + (now.getUTCMonth() - anchorDate.getUTCMonth());
      const periodsPassed = Math.floor(monthsSinceAnchor / 3);
      start.setUTCMonth(start.getUTCMonth() + periodsPassed * 3);

      if (start > now) {
        start.setUTCMonth(start.getUTCMonth() - 3);
      }

      start.setUTCHours(0, 0, 0, 0);
      return { start, end };
    }

    case "yearly": {
      const start = new Date(Date.UTC(now.getUTCFullYear(), anchorDate.getUTCMonth(), anchorDate.getUTCDate(), 0, 0, 0, 0));

      if (start > now) {
        start.setUTCFullYear(start.getUTCFullYear() - 1);
      }

      start.setUTCHours(0, 0, 0, 0);
      return { start, end };
    }

    default:
      throw new Error(`Unknown time period: ${timePeriod}`);
  }
}

describe("Budget Date Range Calculations", () => {
  describe("Quarterly Budget (Issue Case)", () => {
    it("should calculate correct date range for quarterly budget starting Aug 1", () => {
      // User's scenario: Quarterly budget starting Aug 1, checked on Oct 15
      const fixedPeriodStartDate = "2025-08-01";
      const currentDate = new Date("2025-10-15"); // October 15, 2025

      const { start, end } = getBudgetDateRange(
        "quarterly",
        null,
        fixedPeriodStartDate,
        currentDate
      );

      console.log("[TEST] Quarterly budget (Aug 1 start, checked Oct 15):");
      console.log(`  Anchor date: ${fixedPeriodStartDate}`);
      console.log(`  Current date: ${currentDate.toISOString().split("T")[0]}`);
      console.log(`  Calculated start: ${start.toISOString().split("T")[0]}`);
      console.log(`  Calculated end: ${end.toISOString().split("T")[0]}`);

      // Expected: Aug 1 - Oct 15 (current quarter)
      // Anchor: Aug 1, 2025
      // Months since anchor: (2025-2025)*12 + (10-8) = 0 + 2 = 2 months
      // Periods passed: floor(2/3) = 0
      // Start: Aug 1 + (0 * 3 months) = Aug 1
      // Since Aug 1 < Oct 15, start = Aug 1 ✓

      assert.strictEqual(
        start.toISOString().split("T")[0],
        "2025-08-01",
        "Start should be Aug 1, 2025 (beginning of current quarter)"
      );

      assert.strictEqual(
        end.toISOString().split("T")[0],
        "2025-10-15",
        "End should be Oct 15, 2025 (today)"
      );
    });

    it("should include transactions from August, September, and October", () => {
      const fixedPeriodStartDate = "2025-08-01";
      const currentDate = new Date("2025-10-15");

      const { start, end } = getBudgetDateRange(
        "quarterly",
        null,
        fixedPeriodStartDate,
        currentDate
      );

      // Test transactions from different months
      const transactions = [
        { date: "2025-08-15", shouldInclude: true, month: "August" },
        { date: "2025-09-18", shouldInclude: true, month: "September" },
        { date: "2025-10-10", shouldInclude: true, month: "October" },
        { date: "2025-07-30", shouldInclude: false, month: "July (before quarter)" },
        { date: "2025-10-16", shouldInclude: false, month: "October 16+ (future)" },
      ];

      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];

      console.log(`\n[TEST] Date range: ${startStr} to ${endStr}`);

      for (const tx of transactions) {
        const inRange = tx.date >= startStr && tx.date <= endStr;
        console.log(`  ${tx.date} (${tx.month}): ${inRange ? "✓ included" : "✗ excluded"}`);

        assert.strictEqual(
          inRange,
          tx.shouldInclude,
          `Transaction from ${tx.month} should ${tx.shouldInclude ? "be included" : "be excluded"}`
        );
      }
    });

    it("should advance to next quarter on Nov 1", () => {
      const fixedPeriodStartDate = "2025-08-01";
      const currentDate = new Date("2025-11-01"); // Nov 1, 2025

      const { start, end } = getBudgetDateRange(
        "quarterly",
        null,
        fixedPeriodStartDate,
        currentDate
      );

      console.log("\n[TEST] Quarterly budget (Aug 1 start, checked Nov 1):");
      console.log(`  Calculated start: ${start.toISOString().split("T")[0]}`);
      console.log(`  Calculated end: ${end.toISOString().split("T")[0]}`);

      // Months since anchor: (2025-2025)*12 + (11-8) = 3 months
      // Periods passed: floor(3/3) = 1
      // Start: Aug 1 + (1 * 3 months) = Nov 1

      assert.strictEqual(
        start.toISOString().split("T")[0],
        "2025-11-01",
        "Start should be Nov 1, 2025 (next quarter)"
      );

      // August/September transactions should now be excluded
      const augustTx = "2025-08-15";
      const startStr = start.toISOString().split("T")[0];
      assert.ok(
        augustTx < startStr,
        "August transactions should be excluded in November"
      );
    });
  });

  describe("Monthly Budget", () => {
    it("should calculate correct date range for monthly budget starting on 1st", () => {
      const fixedPeriodStartDate = "2025-08-01";
      const currentDate = new Date("2025-10-15");

      const { start, end } = getBudgetDateRange(
        "monthly",
        null,
        fixedPeriodStartDate,
        currentDate
      );

      assert.strictEqual(
        start.toISOString().split("T")[0],
        "2025-10-01",
        "Start should be Oct 1 (current month)"
      );

      assert.strictEqual(
        end.toISOString().split("T")[0],
        "2025-10-15",
        "End should be Oct 15 (today)"
      );
    });

    it("should exclude transactions from previous months", () => {
      const fixedPeriodStartDate = "2025-08-01";
      const currentDate = new Date("2025-10-15");

      const { start, end } = getBudgetDateRange(
        "monthly",
        null,
        fixedPeriodStartDate,
        currentDate
      );

      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];

      // September transaction should be excluded in October
      assert.strictEqual(
        "2025-09-18" < startStr,
        true,
        "September transactions should be excluded in October monthly budget"
      );

      // October transaction should be included
      assert.strictEqual(
        "2025-10-10" >= startStr && "2025-10-10" <= endStr,
        true,
        "October transactions should be included in October monthly budget"
      );
    });
  });

  describe("Rolling Budget", () => {
    it("should calculate last 30 days correctly", () => {
      const currentDate = new Date("2025-10-15");

      const { start, end } = getBudgetDateRange(
        "rolling",
        30,
        null,
        currentDate
      );

      // Start should be 30 days ago from Oct 15 = Sep 15
      assert.strictEqual(
        start.toISOString().split("T")[0],
        "2025-09-15",
        "Start should be Sep 15 (30 days ago)"
      );

      assert.strictEqual(
        end.toISOString().split("T")[0],
        "2025-10-15",
        "End should be Oct 15 (today)"
      );
    });

    it("should include transactions from last 7 days", () => {
      const currentDate = new Date("2025-10-15");

      const { start, end } = getBudgetDateRange(
        "rolling",
        7,
        null,
        currentDate
      );

      const startStr = start.toISOString().split("T")[0];
      const endStr = end.toISOString().split("T")[0];

      // Oct 8 onwards should be included (7 days ago)
      assert.strictEqual(
        "2025-10-10" >= startStr && "2025-10-10" <= endStr,
        true,
        "Oct 10 should be included in last 7 days"
      );

      // Oct 7 should be excluded
      assert.strictEqual(
        "2025-10-07" < startStr,
        true,
        "Oct 7 should be excluded (8 days ago)"
      );
    });
  });

  describe("Weekly Budget", () => {
    it("should calculate correct week for Monday start", () => {
      const fixedPeriodStartDate = "2025-10-13"; // Monday, Oct 13
      const currentDate = new Date("2025-10-15"); // Wednesday, Oct 15

      const { start, end } = getBudgetDateRange(
        "weekly",
        null,
        fixedPeriodStartDate,
        currentDate
      );

      assert.strictEqual(
        start.toISOString().split("T")[0],
        "2025-10-13",
        "Start should be Oct 13 (this Monday)"
      );

      assert.strictEqual(
        end.toISOString().split("T")[0],
        "2025-10-15",
        "End should be Oct 15 (today)"
      );
    });
  });
});
