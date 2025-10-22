import { saveCustomRules, getCustomRules } from "../../storage/categorization/rules.js";
import { findTransactionsByUserId } from "../../storage/repositories/transactions.js";
import { recategorizeAllTransactions } from "../../services/recategorization-service.js";

export interface UpdateCategorizationArgs {
  rules: string;
}

/**
 * Update Categorization Rules Tool
 * Allows users to customize how transactions are categorized, then automatically
 * re-categorizes ALL stored transaction data with the new rules.
 */
export async function updateCategorizationRulesHandler(
  userId: string,
  args: UpdateCategorizationArgs
) {
  const { rules } = args;

  // Validate input
  if (!rules || rules.trim().length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `
⚠️ **Invalid Rules**

Please provide categorization rules. For example:
- "Categorize all Amazon Prime charges as Business expenses"
- "Put Starbucks in Personal Care instead of Food & Dining"
- "Treat Uber rides as Transportation, not Entertainment"

**Current Rules:**
${(await getCustomRules(userId)) || "No custom rules set (using defaults)"}
          `.trim(),
        },
      ],
    };
  }

  try {
    // Save the new rules
    await saveCustomRules(userId, rules.trim());
    console.log(`[UPDATE-RULES] Saved new rules for user ${userId}`);

    // Check if there are transactions to recategorize
    const allTransactions = await findTransactionsByUserId(userId);

    if (allTransactions.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `
✅ **Categorization Rules Updated**

**Your New Rules:**
${rules.trim()}

**No Transactions to Recategorize**

You don't have any transactions yet. Run "Refresh transactions" to sync data from your bank.
            `.trim(),
          },
        ],
      };
    }

    // Trigger async recategorization in background (fire-and-forget)
    console.log(`[UPDATE-RULES] Triggering background recategorization for ${allTransactions.length} transactions`);
    setImmediate(() => {
      recategorizeAllTransactions(userId, rules.trim());
    });

    // Return immediately
    let responseText = `✅ **Categorization Rules Updated**\n\n`;
    responseText += `**Your New Rules:**\n${rules.trim()}\n\n`;
    responseText += `**Background Recategorization Started**\n`;
    responseText += `Re-categorizing ${allTransactions.length} transactions with new rules.\n`;
    responseText += `This may take 1-2 minutes depending on transaction volume.\n\n`;
    responseText += `**Next Steps:**\n`;
    responseText += `- Wait a minute or two for recategorization to complete\n`;
    responseText += `- "Get my transactions" - View updated categories\n`;
    responseText += `- "Check my budgets" - See if budget spending changed\n`;

    return {
      content: [
        {
          type: "text" as const,
          text: responseText.trim(),
        },
      ],
    };
  } catch (error: any) {
    console.error("[UPDATE-RULES] Error:", error);
    return {
      content: [
        {
          type: "text" as const,
          text: `
❌ **Failed to Update Rules**

${error.message}

Please try again or contact support if the issue persists.
          `.trim(),
        },
      ],
    };
  }
}
