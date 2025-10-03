import dotenv from "dotenv";
import express, { Request, Response } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { clerkMiddleware } from "@clerk/express";
import {
  mcpAuthClerk,
  protectedResourceHandlerClerk,
  authServerMetadataHandlerClerk,
  streamableHttpHandler,
} from "@clerk/mcp-tools/express";
import { createServer } from "./create-server.js";
import { verifySignedToken } from "./utils/signed-urls.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment setup
dotenv.config();
const PORT = process.env.PORT || 3000;

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

const { server } = createServer();

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

  // Currently serving static CSV file
  // Future: Query database using payload.userId for user-specific data
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
