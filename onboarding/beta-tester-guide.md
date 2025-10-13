# Beta Tester Setup Guide

Welcome to the Personal Finance MCP beta! This guide will help you get started.

## What You'll Need

- ChatGPT Plus or Team account (required for MCP connector support)
- A Plaid sandbox account (we'll use fake data for testing)
- 10 minutes for setup

## Step 1: Add the MCP Connector

1. Open **ChatGPT** and go to **Settings** → **Connectors**
2. Click **Add Remote Server**
3. Enter the server URL:
   ```
   https://personal-finance-mcp.vercel.app/mcp
   ```
4. Click **Connect**

## Step 2: Authenticate

1. A browser window will open to authenticate via Clerk
2. Sign in with your email (or create an account)
3. Authorize the connection
4. Return to ChatGPT

## Step 3: Start Your First Session

**Option A - Use the Quick Start Link:**

Click this link to open ChatGPT with a pre-filled welcome message:

```
[TODO: Generate and insert the full ?prompt= URL here]
```

**Option B - Manual Start:**

Just open ChatGPT and say:
```
Connect my account
```

## What to Try First

1. **Connect a sandbox account:**
   - Say: "Connect my account"
   - Click the Plaid link
   - Use credentials: `user_good` / `pass_good`
   - Select "First Platypus Bank"

2. **View your balances:**
   - Say: "Show me my account balances"
   - You'll see fake accounts with demo data

3. **Analyze spending:**
   - Say: "Get my transactions from the last month"
   - ChatGPT will download and categorize your transactions
   - Try: "Visualize my spending breakdown"

4. **Customize categories:**
   - Say: "Put all Netflix charges in Entertainment category"
   - Your next analysis will use the updated rules

## Known Issues / Limitations

- **Sandbox data only** - Real bank connections coming soon
- **10-minute download links** - Transaction download URLs expire after 10 minutes
- **Visualization requires manual script run** - Working on automated visualizations

## Need Help?

- **Issues:** Report bugs at [GitHub Issues URL]
- **Questions:** Contact [your email or support channel]
- **Feedback:** We'd love to hear what you think!

## Example Session

```
You: Connect my account
Bot: [Provides Plaid Link URL]
[You click link, connect sandbox bank, return to chat]

You: Show me my account balances
Bot: ✓ Connected Accounts (1 institution)
     First Platypus Bank
     - Checking: $1,200.45
     - Savings: $5,300.00
     - Credit Card: -$450.32

     Would you like me to analyze your spending patterns?

You: Yes, get my transactions from last month
Bot: [Downloads and categorizes 28 transactions]

You: What are my biggest spending categories?
Bot: [AI analyzes the downloaded data...]
```

## What's Next?

We're actively developing:
- Direct visualization in ChatGPT (no manual scripts)
- Budget tracking and alerts
- Investment account support
- Subscription auto-detection

Your feedback will shape these features!
