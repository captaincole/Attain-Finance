/**
 * MCP Server Factory
 * Creates and configures the MCP server with tools and resources
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  type ListResourcesRequest,
  type ListResourceTemplatesRequest,
  type ReadResourceRequest
} from "@modelcontextprotocol/sdk/types.js";
import { PlaidApi } from "plaid";
import { registerAllTools } from "./tools/index.js";
import { CONFIG, getBaseUrl } from "./utils/config.js";

export const createServer = (plaidClient: PlaidApi) => {
  // Create server instance with explicit capabilities
  const server = new McpServer(
    {
      name: "personal-finance",
      version: "1.0.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {}
      }
    }
  );

  // Register all MCP tools
  registerAllTools(server, plaidClient);

  // Register widget resources
  registerWidgetResources(server);

  return { server };
};

/**
 * Register widget resources for ChatGPT integration
 */
function registerWidgetResources(server: McpServer) {
  const widgetUri = CONFIG.widgets.connectedInstitutions.uri;
  const widgetMeta = {
    "openai/widgetDescription": CONFIG.widgets.connectedInstitutions.description,
    "openai/widgetPrefersBorder": true,
    "openai/widgetCSP": {
      connect_domains: [],
      resource_domains: [CONFIG.baseUrl]
    }
  };

  // Generate widget HTML with external script references
  function getWidgetHTML(): string {
    const baseUrl = getBaseUrl();
    return `
<div id="connected-institutions-root"></div>
<link rel="stylesheet" href="${baseUrl}/widgets/connected-institutions.css">
<script type="module" src="${baseUrl}/widgets/connected-institutions.js"></script>
    `.trim();
  }

  // List all available resources
  server.server.setRequestHandler(ListResourcesRequestSchema, async (_request: ListResourcesRequest) => {
    return {
      resources: [
        {
          uri: widgetUri,
          name: CONFIG.widgets.connectedInstitutions.name,
          description: CONFIG.widgets.connectedInstitutions.description,
          mimeType: "text/html+skybridge",
          _meta: widgetMeta
        }
      ]
    };
  });

  // Read a specific resource
  server.server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
    if (request.params.uri !== widgetUri) {
      throw new Error(`Unknown resource: ${request.params.uri}`);
    }

    return {
      contents: [
        {
          uri: widgetUri,
          mimeType: "text/html+skybridge",
          text: getWidgetHTML(),
          _meta: widgetMeta
        }
      ]
    };
  });

  // List resource templates
  server.server.setRequestHandler(ListResourceTemplatesRequestSchema, async (_request: ListResourceTemplatesRequest) => ({
    resourceTemplates: [
      {
        uriTemplate: widgetUri,
        name: CONFIG.widgets.connectedInstitutions.name,
        description: CONFIG.widgets.connectedInstitutions.description,
        mimeType: "text/html+skybridge",
        _meta: widgetMeta
      }
    ]
  }));
}
