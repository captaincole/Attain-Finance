/**
 * Claude API model to use for all requests
 */
const CLAUDE_MODEL = "claude-haiku-4-5-20251001";

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
 * Transaction data for budget filtering
 */
export interface TransactionForBudgetFilter {
  id: string; // Unique identifier for the transaction
  date: string;
  description: string;
  amount: number;
  category: string;
  account_name: string;
  pending: boolean;
}

/**
 * Budget filter result from Claude
 */
export interface BudgetFilterResult {
  transaction_id: string;
  matches: boolean;
  reason: string;
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
      model: CLAUDE_MODEL,
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

  // For large datasets, process in batches with concurrency limit
  const batchCount = Math.ceil(transactions.length / BATCH_SIZE);
  const CONCURRENCY_LIMIT = 5; // Max 5 concurrent batches at a time
  console.log(`[CATEGORIZATION] Processing ${transactions.length} transactions in ${batchCount} batches of ${BATCH_SIZE} (max ${CONCURRENCY_LIMIT} concurrent)`);

  const allCategorized: CategorizedTransaction[] = [];

  // Process batches in groups of CONCURRENCY_LIMIT
  for (let groupStart = 0; groupStart < batchCount; groupStart += CONCURRENCY_LIMIT) {
    const groupEnd = Math.min(groupStart + CONCURRENCY_LIMIT, batchCount);
    const groupSize = groupEnd - groupStart;

    console.log(`[CATEGORIZATION] Processing batch group ${groupStart + 1}-${groupEnd} (${groupSize} batches in parallel)`);

    // Create promises for this group
    const groupPromises = [];
    for (let i = groupStart; i < groupEnd; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, transactions.length);
      const batch = transactions.slice(start, end);

      console.log(`[CATEGORIZATION] Batch ${i + 1}/${batchCount}: Queueing ${batch.length} transactions (${start + 1}-${end})`);

      groupPromises.push(
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

    // Wait for this group to complete before starting next group
    console.log(`[CATEGORIZATION] Waiting for ${groupSize} batches to complete...`);
    const groupResults = await Promise.all(groupPromises);

    // Add results to final array (sorted by index)
    groupResults
      .sort((a, b) => a.index - b.index)
      .forEach((batch) => allCategorized.push(...batch.result));

    console.log(`[CATEGORIZATION] ✓ Group complete (processed ${groupResults.reduce((sum, r) => sum + r.result.length, 0)} transactions)`);
  }

  console.log(`[CATEGORIZATION] ✓ All batches complete: ${allCategorized.length} total categorized`);
  return allCategorized;
}

/**
 * Budget filter prompt template
 */
const BUDGET_FILTER_PROMPT = `You are analyzing bank transactions to determine which ones match a specific budget filter.

# Task
For each transaction, determine if it matches the budget filter criteria and provide a brief reason.

# Filter Criteria
{FILTER_PROMPT}

# Input Format
You will receive transaction data as JSON with fields:
- id: Unique transaction identifier
- date: Transaction date (YYYY-MM-DD)
- description: Merchant or payee name
- amount: Transaction amount (number, positive = expense)
- category: AI-assigned spending category
- account_name: Bank account name
- pending: Whether transaction is pending (boolean)

# Output Format
Return ONLY a valid JSON array with one object per transaction:

\`\`\`json
[
  {
    "transaction_id": "tx-123",
    "matches": true,
    "reason": "Coffee shop purchase at Starbucks"
  },
  {
    "transaction_id": "tx-124",
    "matches": false,
    "reason": "Grocery store, not a coffee shop"
  }
]
\`\`\`

# Rules
1. Be specific with your reasons (mention merchant names, amounts, categories)
2. Use keyword matching on description field as primary signal
3. Consider category field as secondary signal
4. Look for patterns in merchant names (e.g., "Starbucks", "Dunkin", "Coffee" for coffee shops)
5. Return ONLY valid JSON, no explanations or additional text
6. Include ALL transactions in your response, marking each as matches=true or matches=false
7. Preserve the transaction_id exactly as provided
`;

/**
 * Filter a single batch of transactions using Claude API
 */
async function filterBatch(
  transactions: TransactionForBudgetFilter[],
  filterPrompt: string
): Promise<BudgetFilterResult[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY not configured. Add it to your .env file."
    );
  }

  // Get system prompt with filter criteria injected
  const systemPrompt = BUDGET_FILTER_PROMPT.replace(
    "{FILTER_PROMPT}",
    filterPrompt
  );

  // Convert transactions to JSON for Claude
  const transactionsJSON = JSON.stringify(transactions, null, 2);

  console.log(`[BUDGET_FILTER] Filtering batch of ${transactions.length} transactions`);

  // Call Claude API
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 16384, // Increased to handle larger transaction sets
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Filter these transactions:\n\n${transactionsJSON}`,
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

  console.log(`[BUDGET_FILTER] Claude API stop_reason: ${result.stop_reason}`);

  // Check if response was truncated due to token limit
  if (result.stop_reason === "max_tokens") {
    console.error(`[BUDGET_FILTER] ERROR: Response truncated at max_tokens limit`);
    console.error(`[BUDGET_FILTER] Sent ${transactions.length} transactions, but response was cut off`);
    throw new Error(`Response truncated: filtering ${transactions.length} transactions exceeded max_tokens (16384). This budget has too many transactions to filter at once. Try reducing the date range or contact support.`);
  }

  // Parse JSON response
  let jsonText = messageContent.trim();

  // Remove markdown code blocks if present
  if (jsonText.startsWith("```json")) {
    jsonText = jsonText.replace(/^```json\s*\n/, "").replace(/\n```\s*$/, "");
  } else if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```\s*\n/, "").replace(/\n```\s*$/, "");
  }

  try {
    const filterResults: BudgetFilterResult[] = JSON.parse(jsonText);

    // Validate structure
    if (!Array.isArray(filterResults)) {
      throw new Error("Response is not an array");
    }

    const matchCount = filterResults.filter((r) => r.matches).length;
    console.log(
      `[BUDGET_FILTER] ✓ Filtered batch: ${matchCount} matches, ${transactions.length - matchCount} non-matches`
    );

    return filterResults;
  } catch (error) {
    console.error("Failed to parse Claude filter response:", messageContent);
    throw new Error(`Failed to parse filter response: ${error}`);
  }
}

/**
 * Filter transactions using Claude API with automatic batching
 * @param transactions - Array of transactions to filter (any size)
 * @param filterPrompt - Natural language filter criteria from budget
 * @returns Array of filter results indicating which transactions match
 */
export async function filterTransactionsForBudget(
  transactions: TransactionForBudgetFilter[],
  filterPrompt: string
): Promise<BudgetFilterResult[]> {
  const BATCH_SIZE = 50; // Reduced batch size to avoid serverless timeouts

  // If small dataset, process in single batch
  if (transactions.length <= BATCH_SIZE) {
    console.log(`[BUDGET_FILTER] Processing ${transactions.length} transactions in single batch`);
    return filterBatch(transactions, filterPrompt);
  }

  // For large datasets, process in batches with concurrency limit
  const batchCount = Math.ceil(transactions.length / BATCH_SIZE);
  const CONCURRENCY_LIMIT = 5; // Max 5 concurrent batches at a time
  console.log(`[BUDGET_FILTER] Processing ${transactions.length} transactions in ${batchCount} batches of ${BATCH_SIZE} (max ${CONCURRENCY_LIMIT} concurrent)`);

  const allFilterResults: BudgetFilterResult[] = [];

  // Process batches in groups of CONCURRENCY_LIMIT
  for (let groupStart = 0; groupStart < batchCount; groupStart += CONCURRENCY_LIMIT) {
    const groupEnd = Math.min(groupStart + CONCURRENCY_LIMIT, batchCount);
    const groupSize = groupEnd - groupStart;

    console.log(`[BUDGET_FILTER] Processing batch group ${groupStart + 1}-${groupEnd} (${groupSize} batches in parallel)`);

    // Create promises for this group
    const groupPromises = [];
    for (let i = groupStart; i < groupEnd; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, transactions.length);
      const batch = transactions.slice(start, end);

      console.log(`[BUDGET_FILTER] Batch ${i + 1}/${batchCount}: Queueing ${batch.length} transactions (${start + 1}-${end})`);

      groupPromises.push(
        filterBatch(batch, filterPrompt)
          .then((result) => {
            console.log(`[BUDGET_FILTER] Batch ${i + 1}/${batchCount}: ✓ Filtered ${result.length} transactions`);
            return { index: i, result };
          })
          .catch((error) => {
            console.error(`[BUDGET_FILTER] Batch ${i + 1}/${batchCount}: Failed - ${error.message}`);
            throw new Error(`Batch ${i + 1}/${batchCount} failed: ${error.message}`);
          })
      );
    }

    // Wait for this group to complete before starting next group
    console.log(`[BUDGET_FILTER] Waiting for ${groupSize} batches to complete...`);
    const groupResults = await Promise.all(groupPromises);

    // Add results to final array (sorted by index)
    groupResults
      .sort((a, b) => a.index - b.index)
      .forEach((batch) => allFilterResults.push(...batch.result));

    console.log(`[BUDGET_FILTER] ✓ Group complete (processed ${groupResults.reduce((sum, r) => sum + r.result.length, 0)} transactions)`);
  }

  const matchCount = allFilterResults.filter((r) => r.matches).length;
  console.log(`[BUDGET_FILTER] ✓ All batches complete: ${matchCount} matches out of ${allFilterResults.length} total transactions`);

  return allFilterResults;
}
