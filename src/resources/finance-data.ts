import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function transactionsCsvHandler() {
  // Read and return the actual CSV file contents
  const csvPath = path.join(__dirname, "..", "..", "public", "transactions.csv");
  const csvContent = fs.readFileSync(csvPath, "utf-8");

  return {
    contents: [
      {
        uri: "pfinance://data/transactions.csv",
        mimeType: "text/csv",
        text: csvContent,
      },
    ],
  };
}

export async function analysisScriptHandler() {
  // Read and return the actual script file contents
  const scriptPath = path.join(__dirname, "..", "..", "public", "analyze-subscriptions.js");
  const scriptContent = fs.readFileSync(scriptPath, "utf-8");

  return {
    contents: [
      {
        uri: "pfinance://scripts/analyze-subscriptions.js",
        mimeType: "application/javascript",
        text: scriptContent,
      },
    ],
  };
}
