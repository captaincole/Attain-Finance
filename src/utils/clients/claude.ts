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
 * Default categorization prompt template
 */
const CATEGORIZATION_PROMPT = `You are analyzing bank transaction data to categorize spending into meaningful categories.

# Task
Categorize each transaction into ONE of the following categories:

**Core Categories:**
- Housing (rent, mortgage, utilities, internet, phone)
- Transportation (gas, uber, public transit, car payments, parking)
- Food & Dining (groceries, restaurants, coffee, delivery)
- Shopping (retail, clothing, online purchases, general merchandise)
- Entertainment (movies, streaming services, games, hobbies)
- Healthcare (medical, pharmacy, insurance premiums)
- Personal Care (gym, haircuts, beauty, wellness)
- Travel (flights, hotels, vacation expenses)
- Business (office supplies, professional services, business meals)
- Income (salary/payroll, reimbursements, refunds, money received from others)
- Transfer (moving money between accounts, credit card payments, Zelle/Venmo transfers between own accounts)
- Other (anything that doesn't fit above)

# Input Format
You will receive transaction data as CSV with columns:
- date: Transaction date (YYYY-MM-DD)
- description: Merchant or payee name
- amount: Transaction amount (positive = expense)
- category: Plaid's auto-generated category (may be inaccurate, use as a hint only)
- account_name: Bank account name
- pending: Whether transaction is still pending

# Output Format
Return ONLY a valid JSON array with one object per transaction:

\`\`\`json
[
  {
    "date": "2024-12-01",
    "description": "Netflix",
    "amount": "15.99",
    "custom_category": "Entertainment"
  }
]
\`\`\`

# Rules
1. Use the description field as the PRIMARY signal for categorization
2. Consider transaction amounts (e.g., large amounts might be rent/mortgage)
3. Look for keywords to identify Income (PAYROLL, SALARY, DES:, reimbursement, refund) and Transfer (DES:EPAY, Transfer, Zelle payment to yourself)
4. Credit card payments (e.g., "CHASE CREDIT CRD DES:EPAY") should be "Transfer"
5. Money received from others (Venmo, Zelle, PayPal) should be "Income" if it's actual income, or "Transfer" if moving your own money
6. Ignore Plaid's category if it seems wrong based on merchant name
7. Be consistent: same merchant → same category
8. Return ONLY valid JSON, no explanations or additional text
9. Preserve original date, description, and amount exactly as provided

# Custom User Rules
{CUSTOM_RULES}

If custom rules conflict with core categories, ALWAYS prioritize custom rules.
`;

/**
 * Get the categorization prompt with custom rules injected
 */
function getPromptTemplate(customRules?: string): string {
  const rulesText = customRules || "No custom rules defined.";
  return CATEGORIZATION_PROMPT.replace("{CUSTOM_RULES}", rulesText);
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

  // Get prompt template with custom rules injected
  const systemPrompt = getPromptTemplate(customRules);

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
