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
import { userTransactionData } from "./tools/categorization/get-transactions.js";
import { userRawTransactionData } from "./tools/categorization/get-raw-transactions.js";
import { getVisualization } from "./storage/visualization/scripts.js";
import { createPlaidRouter } from "./routes/plaid/index.js";

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

// Favicon route (serve SVG for both .ico and .svg requests)
app.get("/favicon.ico", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "..", "public", "favicon.svg"));
});

const { server } = createServer(plaidClient);

// Minimal logging middleware for MCP requests
app.post("/mcp", (req, res, next) => {
  if (req.body && req.body.method) {
    console.log(`[MCP] ${req.body.method}`);
  }
  next();
}, mcpAuthClerk, streamableHttpHandler(server));

// OAuth metadata endpoints (must be public for discovery)
// ChatGPT expects the protected resource endpoint WITHOUT /mcp suffix
app.get(
  "/.well-known/oauth-protected-resource",
  protectedResourceHandlerClerk({
    resource_url: `${process.env.BASE_URL || "http://localhost:3000"}/mcp`,
    scopes_supported: ["email", "profile"],
  })
);

// Keep the /mcp suffix version for backwards compatibility with Claude Desktop
app.get(
  "/.well-known/oauth-protected-resource/mcp",
  protectedResourceHandlerClerk({
    scopes_supported: ["email", "profile"],
  })
);

// OpenID Configuration (ChatGPT's preferred discovery method)
app.get("/.well-known/openid-configuration", authServerMetadataHandlerClerk);

// OAuth Authorization Server metadata (for older MCP clients)
app.get("/.well-known/oauth-authorization-server", authServerMetadataHandlerClerk);

// Plaid routes (Link UI and callback)
app.use("/plaid", createPlaidRouter(plaidClient));

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

// Signed URL download endpoint for raw transactions (no categorization)
app.get("/api/data/raw-transactions", (req: Request, res: Response) => {
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
  if (payload.resource !== "raw-transactions") {
    return res.status(400).json({ error: "Invalid resource type" });
  }

  const userId = payload.userId;

  // Check if user has raw transaction data
  const csvData = userRawTransactionData.get(userId);
  if (!csvData) {
    return res.status(404).json({ error: "Raw transaction data not found. Please request transactions first." });
  }

  // Set appropriate headers for CSV download
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=raw-transactions.csv");

  // Send CSV data
  res.send(csvData);

  // Clean up after download
  userRawTransactionData.delete(userId);
});

// Download endpoint for user's visualization script
app.get("/api/visualization/:userId", async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId parameter" });
  }

  try {
    // Get user's custom visualization or default
    const scriptContent = await getVisualization(userId);

    // Set appropriate headers for bash script download
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", "attachment; filename=visualize-spending.sh");

    // Send script content
    res.send(scriptContent);
  } catch (error: any) {
    console.error("Error fetching visualization:", error);
    res.status(500).json({ error: error.message });
  }
});

// Export app for Vercel and testing
export { app };
export default app;

// Start server (skip in test mode)
if (process.env.NODE_ENV !== "test") {
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
}
