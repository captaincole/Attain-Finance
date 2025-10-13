import { saveCustomRules, getCustomRules } from "../../storage/categorization/rules.js";
import { getPlaidTransactionsHandler } from "./get-transactions.js";
import { PlaidApi } from "plaid";

export interface UpdateCategorizationArgs {
  rules: string;
}

/**
 * Update Categorization Rules Tool
 * Allows users to customize how transactions are categorized, then automatically
 * re-fetches and re-categorizes their transaction data with the new rules.
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

    // Automatically re-fetch and re-categorize transactions with new rules
    console.log(`Re-categorizing transactions for user ${userId} with new rules`);

    const transactionResult = await getPlaidTransactionsHandler(
      userId,
      baseUrl,
      {}, // Use default date range (last 90 days)
      plaidClient
    );

    // Build success message
    let responseText = `✅ **Categorization Rules Updated**\n\n`;
    responseText += `**Your New Rules:**\n${rules.trim()}\n\n`;
    responseText += `**Auto-Recategorization Complete**\n\n`;
    responseText += `Your transaction data has been automatically re-categorized with the new rules.\n\n`;

    // Include the transaction download info from the result
    const txText = transactionResult.content[0]?.text || "";
    if (txText.includes("Download Instructions")) {
      const downloadSection = txText.substring(txText.indexOf("**Download Instructions**"));
      responseText += downloadSection;
    } else {
      responseText += txText;
    }

    return {
      content: [
        {
          type: "text" as const,
          text: responseText.trim(),
        },
      ],
    };
  } catch (error: any) {
    console.error("Error updating categorization rules:", error);
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
