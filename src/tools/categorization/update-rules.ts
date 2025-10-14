import { saveCustomRules, getCustomRules } from "../../storage/categorization/rules.js";
import { findTransactionsByUserId, updateTransactionCategories } from "../../storage/repositories/transactions.js";
import { categorizeTransactions, TransactionForCategorization } from "../../utils/clients/claude.js";
import { PlaidApi } from "plaid";

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
  baseUrl: string,
  args: UpdateCategorizationArgs,
  plaidClient: PlaidApi
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

    // Re-categorize ALL user transactions in database
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

    console.log(`[UPDATE-RULES] Re-categorizing ${allTransactions.length} transactions`);

    // Prepare for categorization
    const txsForCategorization: TransactionForCategorization[] =
      allTransactions.map((tx) => ({
        date: tx.date,
        description: tx.name,
        amount: tx.amount.toString(),
        category: tx.plaidCategory?.join(", "),
        account_name: tx.accountName || undefined,
        pending: tx.pending ? "true" : "false",
      }));

    // Call Claude API with NEW rules
    const categorized = await categorizeTransactions(
      txsForCategorization,
      rules.trim()
    );

    // Update all transactions in database
    const updates = categorized.map((tx, index) => ({
      transactionId: allTransactions[index].transactionId,
      customCategory: tx.custom_category,
    }));

    await updateTransactionCategories(updates);

    console.log(`[UPDATE-RULES] Re-categorized ${updates.length} transactions`);

    let responseText = `✅ **Categorization Rules Updated**\n\n`;
    responseText += `**Your New Rules:**\n${rules.trim()}\n\n`;
    responseText += `**Auto-Recategorization Complete**\n`;
    responseText += `Re-categorized ${updates.length} transactions with new rules.\n\n`;
    responseText += `**Next Steps:**\n`;
    responseText += `- "Get my transactions" - View updated categories\n`;
    responseText += `- "Check my budgets" - See if budget spending changed\n`;
    responseText += `- "Refresh transactions" - Get latest data from bank\n`;

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
