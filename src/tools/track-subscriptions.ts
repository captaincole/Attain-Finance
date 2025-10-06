import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateSignedUrl } from "../utils/signed-urls.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function trackSubscriptionsHandler(userId: string, baseUrl: string) {
  // Read the analysis prompt
  // In build: __dirname is /path/to/build/tools
  // We need to go up to project root, then into src/prompts
  const promptPath = path.join(__dirname, "..", "..", "src", "prompts", "analyze-subscriptions.txt");
  const analysisPrompt = fs.readFileSync(promptPath, "utf-8");

  // Generate signed download URL (expires in 10 minutes)
  const transactionsUrl = generateSignedUrl(baseUrl, userId, "transactions", 600);

  // Analysis script is served as static file (no authentication needed)
  const scriptUrl = `${baseUrl}/analyze-subscriptions.js`;

  const responseText = `✓ Subscription Tracking Initiated

STEP 1: Download your transaction data (link expires in 10 minutes)
curl "${transactionsUrl}" -o transactions.csv

STEP 2: Download the analysis script
curl "${scriptUrl}" -o analyze-subscriptions.js

STEP 3: Run the analysis
node analyze-subscriptions.js transactions.csv

---

${analysisPrompt}`;

  return {
    content: [
      {
        type: "text" as const,
        text: responseText,
      },
    ],
  };
}
