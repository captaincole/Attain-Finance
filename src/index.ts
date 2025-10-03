import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import {
  mcpAuthClerk,
  protectedResourceHandlerClerk,
  authServerMetadataHandlerClerk,
  streamableHttpHandler,
} from "@clerk/mcp-tools/express";
import { createServer } from "./create-server.js";

// Environment setup
dotenv.config();
const PORT = process.env.PORT || 3000;

// Initialize Express app
const app = express();

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
