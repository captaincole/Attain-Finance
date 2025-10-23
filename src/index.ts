import dotenv from "dotenv";
import express from "express";
import type { Express } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { clerkMiddleware } from "@clerk/express";
import {
  mcpAuthClerk,
  protectedResourceHandlerClerk,
  authServerMetadataHandlerClerk,
  streamableHttpHandler,
} from "@clerk/mcp-tools/express";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PlaidApi } from "plaid";
import { createServer } from "./create-server.js";
import { createPlaidRouter } from "./routes/plaid/index.js";
import { createDataRouter } from "./routes/data/index.js";
import { createVisualizationRouter } from "./routes/visualization.js";
import { createPlaidClient } from "./utils/clients/plaid.js";
import adminRouter from "./routes/admin.js";
import { logEvent, serializeError } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "..", "public");

dotenv.config();
const PORT = process.env.PORT || 3000;
const plaidClient = createPlaidClient();

const { app, server } = initializeApp(plaidClient);

export { app };
export default app;

if (process.env.NODE_ENV !== "test") {
  startServer(app, server, PORT);
}

function initializeApp(plaidClient: PlaidApi) {
  const app = express();

  configureMiddleware(app);
  registerStaticRoutes(app);

  const { server } = createServer(plaidClient);

  registerMcpRoutes(app, server);
  registerOauthDiscoveryRoutes(app);
  registerDomainRoutes(app, plaidClient);
  registerDataRoutes(app);
  registerVisualizationRoutes(app);

  return { app, server };
}

function configureMiddleware(app: Express) {
  app.set("trust proxy", true);

  app.use(
    cors({
      exposedHeaders: ["WWW-Authenticate"],
      origin: true,
      methods: "*",
      allowedHeaders: "Authorization, Origin, Content-Type, Accept, *",
    })
  );
  app.options("*", cors());

  app.use(clerkMiddleware());
  app.use(express.json());
}

function registerStaticRoutes(app: Express) {
  app.use(express.static(PUBLIC_DIR));

  app.get("/favicon.ico", (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "favicon.svg"));
  });
}

function registerMcpRoutes(app: Express, server: McpServer) {
  app.post(
    "/mcp",
    (req, _res, next) => {
      if (req.body && req.body.method) {
        logEvent("SERVER:MCP", "request", { method: req.body.method });
      }
      next();
    },
    mcpAuthClerk,
    streamableHttpHandler(server)
  );
}

function registerOauthDiscoveryRoutes(app: Express) {
  app.get(
    "/.well-known/oauth-protected-resource",
    protectedResourceHandlerClerk({
      resource_url: `${process.env.BASE_URL || "http://localhost:3000"}/mcp`,
      scopes_supported: ["email", "profile"],
    })
  );

  app.get(
    "/.well-known/oauth-protected-resource/mcp",
    protectedResourceHandlerClerk({
      scopes_supported: ["email", "profile"],
    })
  );

  app.get("/.well-known/openid-configuration", authServerMetadataHandlerClerk);
  app.get(
    "/.well-known/oauth-authorization-server",
    authServerMetadataHandlerClerk
  );
}

function registerDomainRoutes(app: Express, plaidClient: PlaidApi) {
  app.use("/plaid", createPlaidRouter(plaidClient));
  app.use("/admin", adminRouter);
}

function registerDataRoutes(app: Express) {
  app.use("/api/data", createDataRouter());
}

function registerVisualizationRoutes(app: Express) {
  app.use("/api/visualization", createVisualizationRouter());
}

function startServer(app: Express, server: McpServer, port: number | string) {
  app.listen(port, () => {
    logEvent("SERVER", "listening", { port });
  });

  process.on("SIGINT", async () => {
    logEvent("SERVER", "shutdown-start");
    try {
      await server.close();
      logEvent("SERVER", "shutdown-complete");
    } catch (error) {
      logEvent("SERVER", "shutdown-error", { error: serializeError(error) }, "error");
    }
    process.exit(0);
  });
}
