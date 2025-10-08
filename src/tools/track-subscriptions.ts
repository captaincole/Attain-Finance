import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateSignedUrl } from "../utils/signed-urls.js";
import { getOpinionsByTool, formatOpinionList } from "../db/opinion-storage.js";

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

  // Fetch available opinions for this tool
  const opinions = await getOpinionsByTool("track-subscriptions");
  const opinionsSection = opinions.length > 0
    ? `\n\n---\n\n## Expert Opinions Available\n\n${formatOpinionList(opinions)}\n\nAfter running the basic analysis, you can apply an expert opinion for additional insights.`
    : "";

  const responseText = `✓ Subscription Tracking Initiated

STEP 1: Download your transaction data (link expires in 10 minutes)
curl "${transactionsUrl}" -o transactions.csv

STEP 2: Download the analysis script
curl "${scriptUrl}" -o analyze-subscriptions.js

STEP 3: Run the analysis
node analyze-subscriptions.js transactions.csv

---

${analysisPrompt}${opinionsSection}`;

  return {
    content: [
      {
        type: "text" as const,
        text: responseText,
      },
    ],
  };
}
