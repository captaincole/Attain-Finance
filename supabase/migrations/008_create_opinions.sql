-- Opinions: Expert analysis frameworks that layer on top of tool outputs
-- Manually curated (no self-service creation yet)

CREATE TABLE opinions (
  id TEXT PRIMARY KEY,  -- e.g., "graham-20-percent-rule"
  name TEXT NOT NULL,  -- "Graham Stephan's 20% Rule"
  author TEXT NOT NULL,  -- "Graham Stephan"
  author_url TEXT,  -- Optional link to their content

  -- Which tool does this opinion apply to?
  tool_name TEXT NOT NULL,  -- "track-subscriptions", "analyze-budget", etc.

  -- The opinion is just a text prompt
  prompt TEXT NOT NULL,

  -- Metadata
  description TEXT,  -- Short summary for listing
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for quick lookup by tool
CREATE INDEX idx_opinions_tool ON opinions(tool_name);

-- Seed data: Example opinion for budgeting
INSERT INTO opinions (id, name, author, tool_name, description, prompt) VALUES
(
  'exclude-large-expenses-budgeting',
  'Exclude Large Expenses from Budget',
  'Personal Finance Influencer',
  'visualize-spending',
  'Remove one-time large purchases to see your true recurring monthly budget',
  'When analyzing spending patterns for budgeting purposes, large one-time expenses can distort your view of regular monthly spending habits.

**Analysis Method:**

1. **Identify Large Expenses**: Review all transactions and identify expenses over $500 (adjust threshold based on your income level)

2. **Categorize Large Expenses**:
   - One-time purchases (furniture, electronics, travel, major repairs)
   - Irregular but expected (insurance premiums, annual subscriptions, taxes)
   - Emergency expenses (medical bills, urgent repairs)

3. **Create Two Views**:
   - **Full Budget**: All expenses included
   - **Recurring Budget**: Large one-time expenses excluded

4. **Calculate Monthly Averages**:
   - For recurring budget: simple average of remaining expenses
   - For irregular expenses: divide by 12 and set aside monthly

**Present Findings:**

- **Full Monthly Spending**: $X,XXX (including large expenses)
- **Recurring Monthly Budget**: $X,XXX (excludes large one-time items)
- **Large Expenses Excluded** (over $500):
  - [Date] - [Description] - $XXX - [Category]
- **Monthly Amount to Save for Irregular Expenses**: $XXX

**Why This Works:**

This method gives you a clearer picture of your baseline monthly budget without the noise of large purchases. It helps you:
- Set realistic monthly budgets based on recurring expenses
- Plan separately for large irregular expenses
- Avoid the "this was an expensive month" trap when budgeting

**Recommended Action:**

Use your recurring monthly budget for day-to-day planning, and create a separate savings fund for irregular large expenses ($XXX/month).

---
*Note: This approach is particularly useful for people with variable income or those who make occasional large purchases.*'
);
