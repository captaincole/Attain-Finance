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

### mint-mcp-token.ts
**⚠️ DEVELOPMENT ONLY** - Mints a Clerk JWT using the MCP bearer template for local testing and staging environments.

**Prerequisites:**
- `CLERK_SECRET_KEY` environment variable configured
- `MCP_BEARER_TEMPLATE_NAME` environment variable configured (Clerk JWT template name)
- User ID must be a valid Clerk user

**Usage:**
```bash
# Via npm script (recommended)
npm run mint-token -- --userId=user_2xyz123

# Direct invocation
npx tsx scripts/mint-mcp-token.ts --userId=user_2xyz123

# With environment override
CLERK_SECRET_KEY=sk_live_xxx npx tsx scripts/mint-mcp-token.ts --userId=user_2xyz123
```

**What it does:**
1. Creates **temporary/ephemeral** Clerk session for target user
2. Mints JWT using configured template (`MCP_BEARER_TEMPLATE_NAME`)
3. Outputs JWT to stdout for use in `.mcp.json` or API requests

**Production vs Development:**
- **Development/Staging**: This script works because it creates arbitrary sessions
- **Production**: Use the `mint-mcp-bearer-token` MCP tool instead
  - Requires user to authenticate via OAuth first
  - Uses existing session (no ephemeral session creation)
  - More secure for production workflows

**Security Notes:**
- Token inherits Clerk template expiry (typically 1 hour)
- Only works for users in `MCP_BEARER_ALLOWED_USER_IDS` (enforced at server level)
- Requires Clerk credentials with session creation permissions
- **Not recommended for production** - use MCP tool for production token minting

**Example Output:**
```
✅ JWT minted successfully:

eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzJ4eXoxMjMiLCJ0ZW1wbGF0ZSI6Im1jcC1hY2Nlc3MiLCJleHAiOjE3MzQxMjM0NTZ9...
```
