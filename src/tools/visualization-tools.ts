import { getVisualization, saveVisualization, resetVisualization } from "../db/visualization-storage.js";
import { customizeVisualization } from "../utils/visualization-client.js";
import { generateSignedUrl } from "../utils/signed-urls.js";

export interface UpdateVisualizationArgs {
  request: string;
}

/**
 * Update Visualization Tool
 * Allows users to customize their spending visualization with natural language requests.
 * Uses Claude API to modify the bash script, then saves it to the database.
 */
export async function updateVisualizationHandler(
  userId: string,
  baseUrl: string,
  args: UpdateVisualizationArgs
) {
  const { request } = args;

  // Validate input
  if (!request || request.trim().length === 0) {
    return {
      content: [
        {
          type: "text" as const,
          text: `
⚠️ **Invalid Request**

Please provide a customization request. For example:
- "Make all the bars green"
- "Show top 15 categories instead of 10"
- "Change the bar character to filled circles"
- "Add colors: green for under $100, yellow for $100-500, red for over $500"

**Current customization:**
You can call \`get-visualization\` to see your current script.
          `.trim(),
        },
      ],
    };
  }

  try {
    console.log(`[UPDATE-VISUALIZATION] User ${userId} request: "${request}"`);

    // Get current visualization (custom or default)
    const currentScript = await getVisualization(userId);

    // Use Claude API to customize the script
    console.log(`[UPDATE-VISUALIZATION] Calling Claude API to customize script...`);
    const modifiedScript = await customizeVisualization(currentScript, request);

    // Save the customized script
    await saveVisualization(userId, modifiedScript);

    // Generate download URL
    const downloadUrl = `${baseUrl}/api/visualization/${userId}`;

    let responseText = `✅ **Visualization Customized**\n\n`;
    responseText += `**Your Request:**\n${request}\n\n`;
    responseText += `**Changes Applied:**\nYour visualization script has been updated and saved.\n\n`;
    responseText += `**Download Your Custom Script:**\n\n\`\`\`bash\ncurl "${downloadUrl}" -o visualize-spending.sh\nchmod +x visualize-spending.sh\n\`\`\`\n\n`;
    responseText += `**Or use the MCP resource:**\nCall \`get-visualization\` to view the script content directly.\n\n`;
    responseText += `**Test it:**\n\`\`\`bash\n./visualize-spending.sh transactions.csv\n\`\`\`\n\n`;
    responseText += `**Reset to default:**\nIf you want to start over, say: "Reset my visualization to default"`;

    return {
      content: [
        {
          type: "text" as const,
          text: responseText.trim(),
        },
      ],
    };
  } catch (error: any) {
    console.error("[UPDATE-VISUALIZATION] Error:", error);
    return {
      content: [
        {
          type: "text" as const,
          text: `
❌ **Customization Failed**

${error.message}

Please try rephrasing your request or contact support if the issue persists.
          `.trim(),
        },
      ],
    };
  }
}

/**
 * Reset Visualization Tool
 * Resets user's visualization to the default script.
 */
export async function resetVisualizationHandler(userId: string, baseUrl: string) {
  try {
    await resetVisualization(userId);

    const downloadUrl = `${baseUrl}/api/visualization/${userId}`;

    let responseText = `✅ **Visualization Reset**\n\n`;
    responseText += `Your visualization has been reset to the default script.\n\n`;
    responseText += `**Download Default Script:**\n\n\`\`\`bash\ncurl "${downloadUrl}" -o visualize-spending.sh\nchmod +x visualize-spending.sh\n\`\`\`\n\n`;
    responseText += `**Customize again:**\nSay something like: "Make all the bars blue" to re-customize.`;

    return {
      content: [
        {
          type: "text" as const,
          text: responseText.trim(),
        },
      ],
    };
  } catch (error: any) {
    console.error("[RESET-VISUALIZATION] Error:", error);
    return {
      content: [
        {
          type: "text" as const,
          text: `
❌ **Reset Failed**

${error.message}

Please try again or contact support if the issue persists.
          `.trim(),
        },
      ],
    };
  }
}
