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
import { logServiceEvent } from "./utils/logger.js";

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
  // Financial Summary Widget Config
  const financialSummaryUri = CONFIG.widgets.financialSummary.uri;
  const financialSummaryMeta = {
    "openai/widgetDescription": CONFIG.widgets.financialSummary.description,
    "openai/widgetPrefersBorder": true,
    "openai/widgetCSP": {
      connect_domains: [],
      resource_domains: [CONFIG.baseUrl]
    }
  };

  // Account Status Widget Config
  const accountStatusUri = CONFIG.widgets.accountStatus.uri;
  const accountStatusMeta = {
    "openai/widgetDescription": CONFIG.widgets.accountStatus.description,
    "openai/widgetPrefersBorder": true,
    "openai/widgetCSP": {
      connect_domains: [],
      resource_domains: [CONFIG.baseUrl]
    }
  };

  // Budget List Widget Config
  const budgetListUri = CONFIG.widgets.budgetList.uri;
  const budgetListMeta = {
    "openai/widgetDescription": CONFIG.widgets.budgetList.description,
    "openai/widgetPrefersBorder": true,
    "openai/widgetCSP": {
      connect_domains: [],
      resource_domains: [CONFIG.baseUrl]
    }
  };

  // Generate Financial Summary widget HTML
  function getFinancialSummaryHTML(): string {
    const baseUrl = getBaseUrl();
    return `
<div id="financial-summary-root"></div>
<link rel="stylesheet" href="${baseUrl}/widgets/connected-institutions.css">
<script type="module" src="${baseUrl}/widgets/financial-summary.js"></script>
    `.trim();
  }

  // Generate Account Status widget HTML
  function getAccountStatusHTML(): string {
    const baseUrl = getBaseUrl();
    return `
<div id="account-status-root"></div>
<link rel="stylesheet" href="${baseUrl}/widgets/connected-institutions.css">
<script type="module" src="${baseUrl}/widgets/account-status.js"></script>
    `.trim();
  }

  // Generate Budget List widget HTML
  function getBudgetListHTML(): string {
    const baseUrl = getBaseUrl();
    return `
<div id="budget-list-root"></div>
<script type="module" src="${baseUrl}/widgets/budget-list.js"></script>
    `.trim();
  }

  // List all available resources
  server.server.setRequestHandler(ListResourcesRequestSchema, async (request: ListResourcesRequest) => {
    logServiceEvent("widgets", "resources-list-request", { params: request.params });

    const resources: any[] = [
      {
        uri: financialSummaryUri,
        name: CONFIG.widgets.financialSummary.name,
        description: CONFIG.widgets.financialSummary.description,
        mimeType: "text/html+skybridge",
        _meta: financialSummaryMeta
      },
      {
        uri: accountStatusUri,
        name: CONFIG.widgets.accountStatus.name,
        description: CONFIG.widgets.accountStatus.description,
        mimeType: "text/html+skybridge",
        _meta: accountStatusMeta
      },
      {
        uri: budgetListUri,
        name: CONFIG.widgets.budgetList.name,
        description: CONFIG.widgets.budgetList.description,
        mimeType: "text/html+skybridge",
        _meta: budgetListMeta
      }
    ];

    const result = { resources };
    logServiceEvent("widgets", "resources-list-response", {
      resourceCount: resources.length,
      uris: resources.map((r) => r.uri),
    });

    return result;
  });

  // Read a specific resource
  server.server.setRequestHandler(ReadResourceRequestSchema, async (request: ReadResourceRequest) => {
    const uri = request.params.uri;
    logServiceEvent("widgets", "resources-read-request", { uri });

    if (uri === financialSummaryUri) {
      const result = {
        contents: [
          {
            uri: financialSummaryUri,
            mimeType: "text/html+skybridge",
            text: getFinancialSummaryHTML(),
            _meta: financialSummaryMeta
          }
        ]
      };
      logServiceEvent("widgets", "resources-read-response", {
        uri,
        mimeType: "text/html+skybridge",
        hasText: true,
      });
      return result;
    }

    if (uri === accountStatusUri) {
      const result = {
        contents: [
          {
            uri: accountStatusUri,
            mimeType: "text/html+skybridge",
            text: getAccountStatusHTML(),
            _meta: accountStatusMeta
          }
        ]
      };
      logServiceEvent("widgets", "resources-read-response", {
        uri,
        mimeType: "text/html+skybridge",
        hasText: true,
      });
      return result;
    }

    // Handle Budget List widget
    if (uri === budgetListUri) {
      const result = {
        contents: [
          {
            uri: budgetListUri,
            mimeType: "text/html+skybridge",
            text: getBudgetListHTML(),
            _meta: budgetListMeta
          }
        ]
      };
      logServiceEvent("widgets", "resources-read-response", {
        uri,
        mimeType: "text/html+skybridge",
        hasText: true,
      });
      return result;
    }

    throw new Error(`Unknown resource: ${uri}`);
  });

  // List resource templates
  server.server.setRequestHandler(ListResourceTemplatesRequestSchema, async (request: ListResourceTemplatesRequest) => {
    logServiceEvent("widgets", "resource-templates-request", { params: request.params });

    const result = {
      resourceTemplates: [
        {
          uriTemplate: financialSummaryUri,
          name: CONFIG.widgets.financialSummary.name,
          description: CONFIG.widgets.financialSummary.description,
          mimeType: "text/html+skybridge",
          _meta: financialSummaryMeta
        },
        {
          uriTemplate: accountStatusUri,
          name: CONFIG.widgets.accountStatus.name,
          description: CONFIG.widgets.accountStatus.description,
          mimeType: "text/html+skybridge",
          _meta: accountStatusMeta
        },
        {
          uriTemplate: budgetListUri,
          name: CONFIG.widgets.budgetList.name,
          description: CONFIG.widgets.budgetList.description,
          mimeType: "text/html+skybridge",
          _meta: budgetListMeta
        }
      ]
    };

    logServiceEvent("widgets", "resource-templates-response", {
      templateCount: result.resourceTemplates.length,
      uris: result.resourceTemplates.map((t) => t.uriTemplate),
    });

    return result;
  });
}
