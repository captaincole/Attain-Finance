# Scripts

Utility scripts for development and testing.

## reset-user.ts

Interactive CLI tool to reset all data for a specific user during testing.

**Usage:**
```bash
npm run reset-user -- --userId=user_xxx
```

**What it does:**
1. Fetches and displays current data summary for the user
2. Shows what will be deleted (connections, accounts, transactions, budgets, etc.)
3. Prompts for confirmation (y/n)
4. If confirmed, deletes all user data via admin endpoint
5. Shows deletion summary

**Example:**
```bash
$ npm run reset-user -- --userId=user_2abc123def456

============================================================
🔧 User Data Reset Tool
============================================================

📊 Fetching data summary for user: user_2abc123def456
   GET http://localhost:3000/admin/user/user_2abc123def456/data-summary

📋 Current Data Summary:
------------------------------------------------------------
{
  "userId": "user_2abc123def456",
  "summary": {
    "hasConnections": true,
    "hasAccounts": true,
    "hasTransactions": true,
    "connectionCount": 1,
    "accountCount": 2,
    "transactionCount": 25
  }
}
------------------------------------------------------------

⚠️  WARNING: This action cannot be undone!
   This will delete:
   • 1 connection(s)
   • 2 account(s)
   • 25 transaction(s)

❓ Do you want to delete ALL this data? (y/n): y

🗑️  Deleting all data for user: user_2abc123def456

✅ Deletion Complete!
✨ User data has been reset successfully!
💡 Next step: Delete user from Clerk dashboard
```

**Requirements:**
- Server must be running (locally or remote)
- `PLAID_ENV` must be `sandbox` or `development` (not `production`)
- `BASE_URL` environment variable should point to your server

**Safety:**
- Only works in non-production environments
- Requires explicit confirmation before deletion
- Shows exactly what will be deleted before proceeding

## Other Scripts

### create-sandbox-user.ts
Creates Plaid sandbox configuration for testing.

```bash
npm run sandbox:create
```

### validate-config.ts
Validates environment configuration.

```bash
npm run sandbox:validate
```
