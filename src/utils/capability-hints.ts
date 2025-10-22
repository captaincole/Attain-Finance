/**
 * Capability Hints Utility
 * Generates context-aware suggestions for ChatGPT to present to users
 *
 * Note: These hints are ChatGPT-facing, not user-facing.
 * They tell ChatGPT what to suggest, and ChatGPT translates them naturally.
 */

export interface CapabilityHint {
  action: string;
  description: string;
}

/**
 * Generate capability hints based on connected account types
 * @param accountTypes - Array of Plaid account types (e.g., 'depository', 'credit', 'investment')
 * @returns Array of capability hints for ChatGPT
 */
export function getAccountCapabilityHints(accountTypes: string[]): CapabilityHint[] {
  const hints: CapabilityHint[] = [];

  // Credit cards and checking accounts → spending analysis
  if (accountTypes.includes('credit') || accountTypes.includes('depository')) {
    hints.push({
      action: "download_transactions_and_analyze_spending",
      description: "Suggest the user download their transactions to analyze spending patterns, find subscriptions, and understand where their money goes."
    });

    hints.push({
      action: "track_subscriptions",
      description: "Offer to help identify recurring charges and subscription services from their transaction history."
    });
  }

  // Savings accounts → savings tracking
  if (accountTypes.includes('depository')) {
    hints.push({
      action: "monitor_savings",
      description: "Suggest tracking savings trends and understanding balance changes over time."
    });
  }

  // Investment accounts → portfolio analysis
  if (accountTypes.includes('investment') || accountTypes.includes('brokerage')) {
    hints.push({
      action: "analyze_investments",
      description: "Offer to review investment performance and portfolio allocation (future capability)."
    });
  }

  return hints;
}

/**
 * Format capability hints for ChatGPT in tool responses
 * @param hints - Array of capability hints
 * @returns Formatted string for inclusion in tool response
 */
export function formatHintsForChatGPT(hints: CapabilityHint[]): string {
  if (hints.length === 0) {
    return "";
  }

  let formatted = "\n\n**ChatGPT: Suggest these capabilities to the user:**\n";
  hints.forEach((hint, index) => {
    formatted += `${index + 1}. ${hint.description}\n`;
  });

  return formatted.trim();
}

/**
 * Get hints for transaction analysis follow-ups
 * @returns Capability hints for after downloading transactions
 */
export function getTransactionAnalysisHints(): CapabilityHint[] {
  return [
    {
      action: "visualize_spending",
      description: "Offer to create a visual breakdown of spending by category."
    },
    {
      action: "customize_categories",
      description: "Suggest customizing transaction categories (e.g., 'Put Netflix in Entertainment category')."
    },
    {
      action: "find_subscriptions",
      description: "Offer to identify all recurring subscription charges."
    }
  ];
}

/**
 * Get hints for visualization customization follow-ups
 * @returns Capability hints for after showing a visualization
 */
