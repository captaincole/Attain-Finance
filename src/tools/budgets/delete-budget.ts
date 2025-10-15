import { z } from "zod";
import { deleteBudget } from "../../storage/budgets/budgets.js";

// Input schema for delete-budget tool
export const DeleteBudgetArgsSchema = z.object({
  id: z.string().describe("Budget ID to delete"),
});

export type DeleteBudgetArgs = z.infer<typeof DeleteBudgetArgsSchema>;

/**
 * Delete Budget Tool Handler
 * Deletes a budget if it's not currently processing
 */
export async function deleteBudgetHandler(
  userId: string,
  args: DeleteBudgetArgs
) {
  console.log(`[DELETE-BUDGET] Deleting budget ${args.id} for user ${userId}`);

  try {
    await deleteBudget(userId, args.id);

    return {
      content: [
        {
          type: "text" as const,
          text: `✅ **Budget Deleted**\n\nThe budget has been successfully removed.`,
        },
      ],
    };
  } catch (error: any) {
    console.error(`[DELETE-BUDGET] Error:`, error.message);

    // Check if it's the "still processing" error
    if (error.message.includes("still processing")) {
      return {
        content: [
          {
            type: "text" as const,
            text: `⏳ **Cannot Delete Budget**\n\n${error.message}\n\nPlease run "Get budgets" to check the processing status, then try deleting again once processing is complete.`,
          },
        ],
        isError: true,
      };
    }

    // Generic error
    return {
      content: [
        {
          type: "text" as const,
          text: `❌ **Error Deleting Budget**\n\n${error.message}`,
        },
      ],
      isError: true,
    };
  }
}
