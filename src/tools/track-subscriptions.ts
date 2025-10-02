import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function trackSubscriptionsHandler() {
  // Read the analysis prompt (from src directory since it's not in build)
  const promptPath = path.join(__dirname, "..", "prompts", "analyze-subscriptions.txt");
  const analysisPrompt = fs.readFileSync(promptPath, "utf-8");

  const responseText = `✓ Subscription Tracking Initiated

AVAILABLE MCP RESOURCES:

1. Transaction Data (CSV)
   MCP Resource URI: pfinance://data/transactions.csv
   Resource Name: transactions-csv
   Description: 3 months of credit card transactions (100 rows)

2. Analysis Script (JavaScript)
   MCP Resource URI: pfinance://scripts/analyze-subscriptions.js
   Resource Name: analysis-script
   Description: Automated subscription detection script
   Usage: node analyze-subscriptions.js [path-to-csv]

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
