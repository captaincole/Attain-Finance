import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Transaction data for categorization
 */
export interface TransactionForCategorization {
  date: string;
  description: string;
  amount: string;
  category?: string;
  account_name?: string;
  pending?: string;
}

/**
 * Categorized transaction result from Claude
 */
export interface CategorizedTransaction {
  date: string;
  description: string;
  amount: string;
  custom_category: string;
}

/**
 * Load the default categorization prompt template
 */
function loadPromptTemplate(): string {
  const promptPath = path.join(__dirname, "../prompts/categorize-transactions.txt");
  return fs.readFileSync(promptPath, "utf-8");
}

/**
 * Categorize a single batch of transactions using Claude API
 * @param transactions - Array of transactions to categorize (max ~50-100 for safety)
 * @param customRules - User's custom categorization rules (optional)
 * @returns Array of categorized transactions
 */
async function categorizeBatch(
  transactions: TransactionForCategorization[],
  customRules?: string
): Promise<CategorizedTransaction[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not configured. Add it to your .env file."
    );
  }

  // Load prompt template and inject custom rules
  const promptTemplate = loadPromptTemplate();
  const rulesText = customRules || "No custom rules defined.";
  const systemPrompt = promptTemplate.replace("{CUSTOM_RULES}", rulesText);

  // Convert transactions to CSV format for Claude
  const csvLines = [
    "date,description,amount,category,account_name,pending",
    ...transactions.map((tx) =>
      [
        tx.date,
        `"${tx.description.replace(/"/g, '""')}"`,
        tx.amount,
        tx.category ? `"${tx.category.replace(/"/g, '""')}"` : '""',
        tx.account_name ? `"${tx.account_name.replace(/"/g, '""')}"` : '""',
        tx.pending || "false",
      ].join(",")
    ),
  ];

  const csvContent = csvLines.join("\n");

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
      max_tokens: 8192, // Increased to handle larger responses
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Categorize these transactions:\n\n${csvContent}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} ${errorText}`);
  }

  const result = await response.json();

  // Extract JSON from Claude's response
  const messageContent = result.content?.[0]?.text;
  if (!messageContent) {
    throw new Error("No response from Claude API");
  }

  // Check if response was truncated due to token limit
  if (result.stop_reason === "max_tokens") {
    console.warn("[CATEGORIZATION] WARNING: Response truncated due to max_tokens limit");
    console.warn(`[CATEGORIZATION] Input: ${transactions.length} transactions, but response was cut off`);
    throw new Error(`Response truncated: sent ${transactions.length} transactions but max_tokens (8192) was reached. Reduce batch size.`);
  }

  console.log(`[CATEGORIZATION] Claude API stop_reason: ${result.stop_reason}`);
  console.log(`[CATEGORIZATION] Response length: ${messageContent.length} characters`);

  // Parse JSON response (Claude might wrap it in markdown code blocks)
  let jsonText = messageContent.trim();

  // Remove markdown code blocks if present
  if (jsonText.startsWith("```json")) {
    jsonText = jsonText.replace(/^```json\s*\n/, "").replace(/\n```\s*$/, "");
  } else if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```\s*\n/, "").replace(/\n```\s*$/, "");
  }

  try {
    const categorized: CategorizedTransaction[] = JSON.parse(jsonText);

    // Validate structure
    if (!Array.isArray(categorized)) {
      throw new Error("Response is not an array");
    }

    return categorized;
  } catch (error) {
    console.error("Failed to parse Claude response:", messageContent);
    throw new Error(`Failed to parse categorization response: ${error}`);
  }
}

/**
 * Categorize transactions using Claude API with automatic batching
 * @param transactions - Array of transactions to categorize (any size)
 * @param customRules - User's custom categorization rules (optional)
 * @returns Array of categorized transactions
 */
export async function categorizeTransactions(
  transactions: TransactionForCategorization[],
  customRules?: string
): Promise<CategorizedTransaction[]> {
  const BATCH_SIZE = 50; // Conservative batch size to stay under token limits

  // If small dataset, process in single batch
  if (transactions.length <= BATCH_SIZE) {
    console.log(`[CATEGORIZATION] Processing ${transactions.length} transactions in single batch`);
    return categorizeBatch(transactions, customRules);
  }

  // For large datasets, process in batches (in parallel for speed)
  const batchCount = Math.ceil(transactions.length / BATCH_SIZE);
  console.log(`[CATEGORIZATION] Processing ${transactions.length} transactions in ${batchCount} parallel batches of ${BATCH_SIZE}`);

  // Create batch promises
  const batchPromises: Promise<{ index: number; result: CategorizedTransaction[] }>[] = [];

  for (let i = 0; i < batchCount; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, transactions.length);
    const batch = transactions.slice(start, end);

    console.log(`[CATEGORIZATION] Batch ${i + 1}/${batchCount}: Queueing ${batch.length} transactions (${start + 1}-${end})`);

    // Queue batch for parallel processing
    batchPromises.push(
      categorizeBatch(batch, customRules)
        .then((result) => {
          console.log(`[CATEGORIZATION] Batch ${i + 1}/${batchCount}: ✓ Categorized ${result.length} transactions`);
          return { index: i, result };
        })
        .catch((error) => {
          console.error(`[CATEGORIZATION] Batch ${i + 1}/${batchCount}: Failed - ${error.message}`);
          throw new Error(`Batch ${i + 1}/${batchCount} failed: ${error.message}`);
        })
    );
  }

  // Wait for all batches to complete in parallel
  console.log(`[CATEGORIZATION] Waiting for ${batchCount} batches to complete in parallel...`);
  const batchResults = await Promise.all(batchPromises);

  // Sort results by original batch order and flatten
  const allCategorized = batchResults
    .sort((a, b) => a.index - b.index)
    .flatMap((batch) => batch.result);

  console.log(`[CATEGORIZATION] ✓ All batches complete: ${allCategorized.length} total categorized`);
  return allCategorized;
}
