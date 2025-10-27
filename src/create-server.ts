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
  // Connected Institutions Widget Config
  const connectedInstitutionsUri = CONFIG.widgets.connectedInstitutions.uri;
  const connectedInstitutionsMeta = {
    "openai/widgetDescription": CONFIG.widgets.connectedInstitutions.description,
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

  const mortgageOptionsUri = CONFIG.widgets.mortgageOptions.uri;
  const mortgageOptionsMeta = {
    "openai/widgetDescription": CONFIG.widgets.mortgageOptions.description,
    "openai/widgetPrefersBorder": true,
    "openai/widgetCSP": {
      connect_domains: [],
      resource_domains: [CONFIG.baseUrl]
    }
  };


  // Generate Connected Institutions widget HTML
  function getConnectedInstitutionsHTML(): string {
    const baseUrl = getBaseUrl();
    return `
<div id="connected-institutions-root"></div>
<link rel="stylesheet" href="${baseUrl}/widgets/connected-institutions.css">
<script type="module" src="${baseUrl}/widgets/connected-institutions.js"></script>
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

  function getMortgageOptionsHTML(): string {
    const baseUrl = getBaseUrl();
    return `
<div id="mortgage-options-root"></div>
<link rel="stylesheet" href="${baseUrl}/widgets/mortgage-options.css">
<script type="module" src="${baseUrl}/widgets/mortgage-options.js"></script>
    `.trim();
  }


  // List all available resources
  server.server.setRequestHandler(ListResourcesRequestSchema, async (request: ListResourcesRequest) => {
    logServiceEvent("widgets", "resources-list-request", { params: request.params });

    const resources: any[] = [
      {
        uri: connectedInstitutionsUri,
        name: CONFIG.widgets.connectedInstitutions.name,
        description: CONFIG.widgets.connectedInstitutions.description,
        mimeType: "text/html+skybridge",
        _meta: connectedInstitutionsMeta
      },
      {
        uri: budgetListUri,
        name: CONFIG.widgets.budgetList.name,
        description: CONFIG.widgets.budgetList.description,
        mimeType: "text/html+skybridge",
        _meta: budgetListMeta
      },
      {
        uri: mortgageOptionsUri,
        name: CONFIG.widgets.mortgageOptions.name,
        description: CONFIG.widgets.mortgageOptions.description,
        mimeType: "text/html+skybridge",
        _meta: mortgageOptionsMeta
      },
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

    // Handle Connected Institutions widget
    if (uri === connectedInstitutionsUri) {
      const result = {
        contents: [
          {
            uri: connectedInstitutionsUri,
            mimeType: "text/html+skybridge",
            text: getConnectedInstitutionsHTML(),
            _meta: connectedInstitutionsMeta
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

    if (uri === mortgageOptionsUri) {
      const result = {
        contents: [
          {
            uri: mortgageOptionsUri,
            mimeType: "text/html+skybridge",
            text: getMortgageOptionsHTML(),
            _meta: mortgageOptionsMeta
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
          uriTemplate: connectedInstitutionsUri,
          name: CONFIG.widgets.connectedInstitutions.name,
          description: CONFIG.widgets.connectedInstitutions.description,
          mimeType: "text/html+skybridge",
          _meta: connectedInstitutionsMeta
        },
      {
        uriTemplate: budgetListUri,
        name: CONFIG.widgets.budgetList.name,
        description: CONFIG.widgets.budgetList.description,
        mimeType: "text/html+skybridge",
        _meta: budgetListMeta
      },
      {
        uriTemplate: mortgageOptionsUri,
        name: CONFIG.widgets.mortgageOptions.name,
        description: CONFIG.widgets.mortgageOptions.description,
        mimeType: "text/html+skybridge",
        _meta: mortgageOptionsMeta
      },
    ]
  };

    logServiceEvent("widgets", "resource-templates-response", {
      templateCount: result.resourceTemplates.length,
      uris: result.resourceTemplates.map((t) => t.uriTemplate),
    });

    return result;
  });
}
