import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load the visualization customization prompt template
 */
function loadPromptTemplate(): string {
  const promptPath = path.join(__dirname, "../prompts/customize-visualization.txt");
  return fs.readFileSync(promptPath, "utf-8");
}

/**
 * Customize a visualization script using Claude API
 * @param currentScript - The current bash script
 * @param userRequest - User's customization request (e.g., "make all bars green")
 * @returns Modified bash script
 */
export async function customizeVisualization(
  currentScript: string,
  userRequest: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not configured. Add it to your .env file."
    );
  }

  // Load prompt template and inject user request
  const promptTemplate = loadPromptTemplate();
  const systemPrompt = promptTemplate.replace("{USER_REQUEST}", userRequest);

  console.log(`[VISUALIZATION] Customizing script based on: "${userRequest}"`);

  // Call Claude API
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Current script:\n\n${currentScript}\n\nCustomization request: ${userRequest}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errorText}`);
  }

  const result = await response.json();

  // Extract script from Claude's response
  const messageContent = result.content?.[0]?.text;
  if (!messageContent) {
    throw new Error("No response from Claude API");
  }

  console.log(`[VISUALIZATION] Claude API stop_reason: ${result.stop_reason}`);
  console.log(`[VISUALIZATION] Response length: ${messageContent.length} characters`);

  // Clean up response - remove markdown code blocks if present
  let modifiedScript = messageContent.trim();

  if (modifiedScript.startsWith("```bash")) {
    modifiedScript = modifiedScript.replace(/^```bash\s*\n/, "").replace(/\n```\s*$/, "");
  } else if (modifiedScript.startsWith("```")) {
    modifiedScript = modifiedScript.replace(/^```\s*\n/, "").replace(/\n```\s*$/, "");
  }

  // Validate it starts with shebang
  if (!modifiedScript.startsWith("#!/bin/bash")) {
    throw new Error("Modified script doesn't start with #!/bin/bash - validation failed");
  }

  console.log(`[VISUALIZATION] ✓ Script customized successfully`);
  return modifiedScript;
}
