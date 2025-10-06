import dotenv from "dotenv";
import express, { Request, Response } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { clerkMiddleware } from "@clerk/express";
import {
  mcpAuthClerk,
  protectedResourceHandlerClerk,
  authServerMetadataHandlerClerk,
  streamableHttpHandler,
} from "@clerk/mcp-tools/express";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { createServer } from "./create-server.js";
import { verifySignedToken } from "./utils/signed-urls.js";
import { userTransactionData } from "./tools/plaid-transactions.js";
import { saveConnection } from "./db/plaid-storage.js";
import { getSession, completeSession, failSession } from "./db/plaid-sessions.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment setup
dotenv.config();
const PORT = process.env.PORT || 3000;

// Initialize Plaid client
const plaidConfiguration = new Configuration({
  basePath:
    process.env.PLAID_ENV === "production"
      ? PlaidEnvironments.production
      : process.env.PLAID_ENV === "development"
      ? PlaidEnvironments.development
      : PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID || "",
      "PLAID-SECRET": process.env.PLAID_SECRET || "",
    },
  },
});

const plaidClient = new PlaidApi(plaidConfiguration);

// Initialize Express app
const app = express();

// Trust proxy headers (required for Vercel/serverless environments)
app.set("trust proxy", true);

// CORS must expose WWW-Authenticate header for OAuth
app.use(
  cors({
    exposedHeaders: ["WWW-Authenticate"],
    origin: true,
    methods: "*",
    allowedHeaders: "Authorization, Origin, Content-Type, Accept, *",
  })
);
app.options("*", cors());

// Clerk authentication middleware
app.use(clerkMiddleware());
app.use(express.json());

// Serve static files from public/ directory (analysis scripts, sample data, etc.)
app.use(express.static(path.join(__dirname, "..", "public")));

const { server } = createServer(plaidClient);

// Protected MCP endpoint (requires authentication)
app.post("/mcp", mcpAuthClerk, streamableHttpHandler(server));

// OAuth metadata endpoints (must be public for discovery)
app.get(
  "/.well-known/oauth-protected-resource/mcp",
  protectedResourceHandlerClerk({
    scopes_supported: ["email", "profile"],
  })
);

// For older MCP clients that use the older spec
app.get("/.well-known/oauth-authorization-server", authServerMetadataHandlerClerk);

// Plaid Link UI endpoint
app.get("/plaid/link", (req: Request, res: Response) => {
  const { token, session } = req.query;

  if (!token || !session) {
    return res.status(400).send("Missing token or session parameter");
  }

  // Get base URL from environment
  const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;

  // Serve HTML page that initializes Plaid Link
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Connect Your Bank - Personal Finance MCP</title>
      <script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
          background: white;
          padding: 3rem;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          text-align: center;
          max-width: 400px;
        }
        h1 { margin-top: 0; color: #333; font-size: 1.5rem; }
        .status { margin: 2rem 0; color: #666; }
        .spinner {
          border: 3px solid #f3f3f3;
          border-top: 3px solid #667eea;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .success { color: #10b981; }
        .error { color: #ef4444; }
        .accounts {
          text-align: left;
          margin: 1rem 0;
          padding: 1rem;
          background: #f9fafb;
          border-radius: 8px;
        }
        .account {
          padding: 0.5rem 0;
          border-bottom: 1px solid #e5e7eb;
        }
        .account:last-child { border-bottom: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Connect Your Bank</h1>
        <div class="status" id="status">
          <div class="spinner"></div>
          <p>Opening secure connection...</p>
        </div>
      </div>

      <script>
        const linkToken = "${token}";
        const sessionId = "${session}";

        // Initialize Plaid Link
        const handler = Plaid.create({
          token: linkToken,
          onSuccess: async (public_token, metadata) => {
            document.getElementById('status').innerHTML =
              '<div class="spinner"></div><p>Connecting your bank...</p>';

            // Send public_token to our server
            try {
              const response = await fetch('${baseUrl}/plaid/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  public_token,
                  session: sessionId,
                  metadata
                }),
              });

              if (response.ok) {
                const data = await response.json();
                let accountsHtml = '';
                if (data.accounts && data.accounts.length > 0) {
                  accountsHtml = '<div class="accounts">' +
                    data.accounts.map(acc =>
                      \`<div class="account"><strong>\${acc.name}</strong> (\${acc.type})</div>\`
                    ).join('') +
                    '</div>';
                }

                document.getElementById('status').innerHTML =
                  \`<h2 class="success">✓ Connected!</h2>
                   <p>Successfully connected \${data.accounts.length} account(s)</p>
                   \${accountsHtml}
                   <p style="margin-top: 2rem; color: #666; font-size: 0.9rem;">
                     You can now return to Claude Desktop and continue.
                   </p>\`;
              } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Connection failed');
              }
            } catch (error) {
              console.error('Error:', error);
              document.getElementById('status').innerHTML =
                \`<h2 class="error">✗ Error</h2>
                 <p>Connection failed: \${error.message}</p>
                 <p style="font-size: 0.9rem; margin-top: 1rem;">Please return to Claude Desktop and try again.</p>\`;
            }
          },
          onExit: (err, metadata) => {
            if (err) {
              document.getElementById('status').innerHTML =
                '<h2 class="error">Connection Cancelled</h2><p>You can close this window and try again.</p>';
            } else {
              document.getElementById('status').innerHTML =
                '<p>Connection cancelled. You can close this window.</p>';
            }
          },
        });

        // Auto-open Plaid Link when page loads
        handler.open();
      </script>
    </body>
    </html>
  `);
});

// Plaid callback endpoint (handles automatic token exchange)
app.post("/plaid/callback", async (req: Request, res: Response) => {
  const { public_token, session, metadata } = req.body;

  console.log("Plaid callback received:", {
    hasPublicToken: !!public_token,
    session,
    sessionLength: session?.length,
    sessionType: typeof session,
  });

  if (!public_token || !session) {
    console.error("Missing required fields:", { public_token: !!public_token, session });
    return res.status(400).json({ error: "Missing public_token or session" });
  }

  // Verify session exists in database and get userId
  const sessionData = await getSession(session);

  console.log("Session lookup from database:", {
    receivedSession: session,
    found: !!sessionData,
    userId: sessionData?.user_id,
    status: sessionData?.status,
  });

  if (!sessionData) {
    return res.status(400).json({ error: "Invalid or expired session" });
  }

  if (sessionData.status === "completed") {
    return res.status(400).json({ error: "Session already completed" });
  }

  const userId = sessionData.user_id;

  try {
    // Exchange public_token for access_token
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;

    // Save to database (encrypted)
    await saveConnection(userId, accessToken, itemId);

    // Fetch account details for response
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const accounts = accountsResponse.data.accounts;

    // Mark session as completed in database
    await completeSession(session);

    console.log(`✓ Bank connected for user ${userId}: ${itemId}`);

    // Return success
    res.json({
      success: true,
      item_id: itemId,
      accounts: accounts.map((acc) => ({
        name: acc.name,
        type: acc.type,
      })),
    });
  } catch (error: any) {
    console.error("Error exchanging public token:", error);
    await failSession(session, error.message);

    res.status(500).json({
      error: "Failed to connect bank account",
      details: error.message,
    });
  }
});

// Signed URL download endpoint for user transactions
app.get("/api/data/transactions", (req: Request, res: Response) => {
  const token = req.query.token as string;

  if (!token) {
    return res.status(400).json({ error: "Missing token parameter" });
  }

  // Verify the signed token
  const payload = verifySignedToken(token);

  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  // Validate resource type
  if (payload.resource !== "transactions") {
    return res.status(400).json({ error: "Invalid resource type" });
  }

  const userId = payload.userId;

  // Check if user has Plaid transaction data (takes priority over static file)
  const csvData = userTransactionData.get(userId);
  if (csvData) {
    // Set appropriate headers for CSV download
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=transactions.csv");

    // Send CSV data
    res.send(csvData);

    // Clean up after download
    userTransactionData.delete(userId);
    return;
  }

  // Fallback: serve static CSV file for non-Plaid requests
  const csvPath = path.join(__dirname, "..", "public", "transactions.csv");

  if (!fs.existsSync(csvPath)) {
    return res.status(404).json({ error: "Transaction data not found" });
  }

  // Set appropriate headers for CSV download
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=transactions.csv");

  // Stream the file
  const fileStream = fs.createReadStream(csvPath);
  fileStream.pipe(res);

  fileStream.on("error", (error) => {
    console.error("Error streaming file:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Error streaming file" });
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`MCP Server with Clerk Auth listening on port ${PORT}`);
});

// Handle server shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  try {
    await server.close();
    console.log("Server shutdown complete");
  } catch (error) {
    console.error("Error closing server:", error);
  }
  process.exit(0);
});
