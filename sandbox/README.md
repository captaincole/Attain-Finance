# Plaid Custom Sandbox User Data

This directory contains CSV data files and scripts for generating a custom Plaid sandbox user (`custom_andrew`) with realistic transaction data.

## Purpose

The `custom_andrew` user provides an alternative to Plaid's default `user_good` sandbox account, with **real-looking transaction data** parsed from actual bank statements (anonymized). This is useful for:

- Manual development testing of the Plaid integration
- QA testing with realistic spending patterns
- Demonstrating the app with varied transaction categories

## Contents

- **`data/`** - CSV files from various institutions (BofA, Chase, Venmo)
- **`custom-user-config.json`** - Generated Plaid custom user configuration (gitignored)

## Usage

### Generate Custom Sandbox User Config

```bash
npm run sandbox:create
```

This script:
1. Parses CSV files from `data/` directory
2. Converts transactions to Plaid format
3. Generates `custom-user-config.json` for Plaid's custom sandbox user API

### Validate Configuration

```bash
npm run sandbox:validate
```

Checks that the generated config is valid.

### Using in Plaid Link

When testing Plaid connection flows, use these credentials:

- **Username:** `custom_andrew`
- **Password:** `pass_good`
- **2FA Code:** `1234`

## Automated Testing vs Manual Testing

| Use Case | Recommended Approach |
|----------|---------------------|
| **Automated tests** | Use mocked Plaid client (no real Plaid API calls) |
| **Manual development testing** | Use `custom_andrew` OR `user_good` sandbox users |
| **Demo environment** | Use `supabase/seed.sql` (deterministic seeded data) |
| **Production** | Real Plaid connections |

## Note

This sandbox data is **NOT used by automated tests** (which use mocks) or the **demo environment** (which uses `supabase/seed.sql`). It exists solely for manual development testing with Plaid's sandbox.
