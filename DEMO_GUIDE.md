# Demo Environment Guide

This document summarizes the demo-specific seed scripts, MCP tools, and widgets available in the `demo-investments-mvp` branch. Use it as a quick reference when resetting data or walking through the demo experience.

---

## 1. Seed Scripts

All demo data is seeded via CLI scripts that write to dedicated `demo_*` tables in Supabase. Run them from the repo root (after exporting the correct environment variables).

| Dataset | Script | npm alias | Notes |
|---------|--------|-----------|-------|
| Banking (Bank of America checking) | `tsx scripts/seed-demo-banking.ts --userId=<demoUser>` | `npm run demo:seed-banking` | Seeds one checking account (~$20k balance) plus recent deposits/payments. |
| Liabilities (Mortgage + Student Loan + Credit score) | `tsx scripts/seed-demo-liabilities.ts --userId=<demoUser>` | `npm run demo:seed-liabilities` | Creates mortgage + student loan ledgers and a credit score snapshot (720). |
| Investments (Brokerage cash + GOOG position) | `tsx scripts/seed-demo-investments.ts --userId=<demoUser>` | `npm run demo:seed` | Adds demo investment account to complement real Plaid accounts. |
| Transactions (Chase credit card sample) | `tsx scripts/seed-demo-transactions.ts --userId=<demoUser>` | `npm run demo:seed-transactions` | Loads `sandbox/data/chasedata.csv`, shifts dates so the latest transaction is “today,” and seeds two months of credit-card activity. |

Each seeder has a matching `reset` script (`npm run demo:reset-...`) that clears the demo tables before reseeding.

### Supabase Migrations

The following demo-specific migrations must be applied to the Supabase project used for testing:

- `018_create_demo_investment_tables.sql`
- `019_create_demo_liability_tables.sql`
- `020_create_demo_banking_tables.sql`
- `021_create_demo_transaction_tables.sql`

Use `supabase db push --db-url <...>` (or equivalent) to keep the test database in sync.

---

## 2. MCP Tools (Demo-focused)

Demo tools are registered via `getDemoTools()` and exposed alongside standard tools. Notable endpoints:

| Tool | Path in code | Description | Notes |
|------|--------------|-------------|-------|
| `get-investments` | `src/tools/demo/investments.ts` | Returns demo brokerage account + cash position, along with summary metrics. |
| `get-debt-overview` | `src/tools/demo/liabilities.ts` | Summarizes mortgage and student loan ledgers (APR, payoff horizon, min payment). |
| `get-credit-score` | `src/tools/demo/liabilities.ts` | Serves the seeded credit score snapshot. |
| `get-transactions` | `src/tools/transactions/index.ts` → `src/tools/demo/transactions.ts` | Returns the demo Chase credit card transactions, category totals, CSV download link, and spending summary (no widget). |
| `get-account-balances` | `src/tools/accounts/handlers.ts` | Injects demo banking, investment, liability, and transaction accounts into the standard balances response (with grouped summary text). |

### Widget Availability

- `connected-institutions` (accounts widget) now displays a grouped list by account type (cash, investments, credit, loans) with balances aligned right.
- `spending-summary` widget was removed after simplifying the approach—`get-transactions` now returns text + structured data only.

---

## 3. Demo Data Tables (Supabase)

All demo entities live in separate `demo_*` tables so they won’t interfere with real Plaid data:

- Banking: `demo_banking_accounts`, `demo_banking_transactions`
- Investments: `demo_investment_accounts`, `demo_investment_securities`, `demo_investment_holdings`
- Liabilities: `demo_liability_accounts`, `demo_liability_details`, `demo_credit_scores`
- Transactions (credit card): `demo_transaction_accounts`, `demo_transactions`

Use the provided seed/reset scripts to populate or clear these tables for a demo walkthrough.

---

## 4. Typical Demo Flow

1. **Reset/seed data** for the chosen demo user:
   ```bash
   npm run demo:reset-all
   # or run individually:
   npm run demo:reset-banking
   npm run demo:reset-liabilities
   npm run demo:reset       # investments
   npm run demo:reset-transactions
   ```

2. **Connect a real Plaid account** (e.g., sandbox access token) using the existing `connect-account` tool.

3. **Use ChatGPT or Claude** to call:
   - `get-account-balances` → shows real + demo accounts grouped by type.
   - `get-debt-overview` → mortgage/student loan details.
   - `get-investments` → demo brokerage snapshot.
   - `get-transactions` → recent credit card activity (with CSV link).

4. **Discuss spending or payoff strategies** using the returned structured data (no additional widgets required).

---

## 5. Demo Storyboard

### Script
- Chat as OS: Position the agent as the finance tile inside the coming chat app store, and explain that every demo action is happening over `/mcp`.
Prompt: Show me my account balances
- Financial connectivity: Walk through linking Plaid via `connect-account`, then run `get-account-balances` to show consolidated real + demo accounts in the widget.
Prompt: Give me a breakdown of my spending in the last month as a cash flow analysis. Remove my donation as that is a one time expense and show me how much money I am saving and what my top 3 spending categories are. Show a bar chart of the expenses instead of a table. 
- Save Generative Homepage
prompt: Could you save this analysis as my financial homepage?
- High-value analysis: Ask the assistant if a $4k/month mortgage is feasible and chain `get-transactions`, `get-debt-overview`, and `get-investments` to illustrate cash flow, payoff timelines, and investment runway insights.
Prompt: Would a 4k per month mortgage be feasible if I wanted to buy a house?
- In-situ recommendations: While reviewing mortgage readiness, surface Morgan Stanley and Chase offers plus an Attain Finance CTA, emphasizing trusted, actionable links directly within chat.
Prompt: Prompt: What mortgage would be feasible, and if you have the interest rate what price could I afford for a house?
- Generative home page: Capture the prior guidance as a saved “Home Page” prompt so the assistant replays balances, transactions, budget status, and debt alerts on demand.
Prompt: - Show me my financial homepage

### Capabilities
- **Chat-As-OS Narrative**: Polished intro script; ensure `registerAllTools` metadata and widget assets render well in tools listing.
- **Financial Connectivity**: `connect-account` Plaid Link flow, `get-account-balances` widget output, signed CSV download endpoint, and seeded demo accounts via all `demo:seed-*` scripts.
- **High-Value Analysis**: `get-transactions`, `get-debt-overview`, `get-investments`, budget tooling (`get-budgets`, `create-budget`), and scripted assistant guidance stitching the results together.
- **In-Situ Recommendations**: Recommendation surface with partner links, Attain Finance teaser card, signed link generation, and logging so offer delivery remains auditable.
- **Generative Home Page UI**: Mechanism to save/replay prompts, existing account/budget widgets, ability to rehydrate prior tool responses for a persistent dashboard. - New tool called `save-financial-homepage` that saves a prompt that will retrigger chat to call the appropriate functions on our site and perform the analysis. Go to a new chat to show `get-financial-homepage`.

---

## 6. Manual Testing Checklist

- [ ] Run each `demo:reset-*` script with the target demo user ID.
- [ ] Trigger `get-account-balances` → confirm grouped widget renders.
- [ ] Call `get-transactions` → confirm sample data (latest date == today), CSV download works.
- [ ] Review `get-debt-overview` and `get-investments` responses for seeded snapshots.
- [ ] Connect a real Plaid sandbox account and ensure it appears alongside demo data.

---

### Useful Paths

- Seed scripts: `scripts/seed-demo-*.ts`, `scripts/reset-demo-*.ts`
- Demo data builders: `src/demo-data/*.ts`
- Demo storage helpers: `src/storage/demo/*.ts`
- Demo tools: `src/tools/demo/*.ts`
- Account handler injection: `src/tools/accounts/handlers.ts`
- Account widget: `widgets/src/connected-institutions.tsx`

---

Keep this file updated as new demo datasets or tools are added. The goal is to maintain a single reference for the full demo experience without digging through implementation details.
