/**
 * Mock Claude client for testing
 * Implements the ClaudeClient interface using simple keyword matching
 * Prevents actual API calls and provides deterministic responses for tests
 */

import {
  ClaudeClient,
  TransactionForCategorization,
  CategorizedTransaction,
  TransactionForBudgetFilter,
  BudgetFilterResult,
} from "../../src/utils/clients/claude.js";

export class MockClaudeClient implements ClaudeClient {
  /**
   * Mock categorization function
   * Uses simple keyword-based rules instead of calling Claude API
   */
  categorizeTransactions(
    transactions: TransactionForCategorization[],
    customRules?: string
  ): CategorizedTransaction[] {
    console.log(
      `[MOCK-CLAUDE] Categorizing ${transactions.length} transactions (mock mode)`
    );

    return transactions.map((tx) => {
      const desc = tx.description.toLowerCase();
      let category = "Other";

      // Simple keyword-based categorization
      if (desc.includes("coffee") || desc.includes("starbucks")) {
        category = "Food & Dining";
      } else if (
        desc.includes("grocery") ||
        desc.includes("whole foods") ||
        desc.includes("safeway")
      ) {
        category = "Groceries";
      } else if (desc.includes("gas") || desc.includes("shell") || desc.includes("chevron")) {
        category = "Transportation";
      } else if (desc.includes("rent") || desc.includes("mortgage")) {
        category = "Housing";
      } else if (
        desc.includes("utility") ||
        desc.includes("electric") ||
        desc.includes("water")
      ) {
        category = "Utilities";
      } else if (desc.includes("amazon") || desc.includes("target")) {
        category = "Shopping";
      } else if (desc.includes("netflix") || desc.includes("spotify")) {
        category = "Entertainment";
      } else if (desc.includes("interest") || desc.includes("payroll")) {
        category = "Income";
      }

      // Apply custom rules if provided (simple keyword matching)
      if (customRules) {
        const rulesLower = customRules.toLowerCase();
        if (rulesLower.includes("amazon") && rulesLower.includes("business")) {
          if (desc.includes("amazon")) {
            category = "Business";
          }
        }
      }

      return {
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        custom_category: category,
      };
    });
  }

  /**
   * Mock budget filter function
   * Uses simple keyword matching instead of calling Claude API
   */
  filterTransactionsForBudget(
    transactions: TransactionForBudgetFilter[],
    filterPrompt: string
  ): BudgetFilterResult[] {
    console.log(
      `[MOCK-CLAUDE] Filtering ${transactions.length} transactions for budget (mock mode)`
    );

    const promptLower = filterPrompt.toLowerCase();

    return transactions.map((tx) => {
      const descLower = tx.description.toLowerCase();
      let matches = false;
      let reason = "Does not match budget criteria";

      // Extract keywords from filter prompt (words longer than 3 chars)
      const keywords = promptLower.match(/\b[a-z]{4,}\b/g) || [];

      // Check if transaction description contains any keyword from filter
      for (const keyword of keywords) {
        if (descLower.includes(keyword)) {
          matches = true;
          reason = `Matches keyword from filter: "${keyword}"`;
          break;
        }
      }

      return {
        transaction_id: tx.id,
        matches,
        reason,
      };
    });
  }
}
