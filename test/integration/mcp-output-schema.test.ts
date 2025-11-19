/**
 * Integration tests for MCP output schema
 * Tests that tools with outputSchema correctly expose it in tools/list
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import { MockPlaidClient } from "../mocks/plaid-mock.js";
import { createServer } from "../../src/create-server.js";

describe("MCP Output Schema", () => {
  it("should expose outputSchema for get-budgets tool", async () => {
    // Create server with mock Plaid client
    const mockPlaidClient = new MockPlaidClient();
    const { server } = createServer(mockPlaidClient as any);

    // Access the internal tool registry
    const serverInternal = server.server as any;
    const toolsHandler = serverInternal._requestHandlers.get("tools/list");

    assert(toolsHandler, "Server should have tools/list handler");

    // Call the handler directly (bypassing HTTP/auth)
    const result = await toolsHandler({
      method: "tools/list",
      params: {}
    });

    // Verify tools list structure
    assert(result.tools, "Should return tools array");
    assert(Array.isArray(result.tools), "Tools should be an array");

    // Find get-budgets tool
    const getBudgetsTool = result.tools.find(
      (t: any) => t.name === "get-budgets"
    );

    assert(getBudgetsTool, "Should include get-budgets tool");

    // CRITICAL: Verify outputSchema field exists
    assert(
      getBudgetsTool.outputSchema,
      "get-budgets tool MUST have outputSchema field"
    );

    // Verify outputSchema structure
    assert.equal(
      getBudgetsTool.outputSchema.type,
      "object",
      "outputSchema should be an object type"
    );

    assert(
      getBudgetsTool.outputSchema.properties,
      "outputSchema should have properties"
    );

    // Verify structuredContent property (we only type this field, not content or _meta)
    const props = getBudgetsTool.outputSchema.properties;
    assert(props.structuredContent, "Should have structuredContent property");

    // Verify structuredContent has detailed schema
    assert(
      props.structuredContent.properties,
      "structuredContent should have nested properties"
    );

    const structuredProps = props.structuredContent.properties;
    assert(structuredProps.budgets, "Should have budgets array schema");
    assert(structuredProps.widgetInstructions, "Should have widgetInstructions schema");
    assert(structuredProps.exampleBudgets, "Should have exampleBudgets schema");

    // Verify budgets array has item schema
    assert.equal(
      structuredProps.budgets.type,
      "array",
      "budgets should be array type"
    );
    assert(
      structuredProps.budgets.items,
      "budgets array should have items schema"
    );

    // Verify budget item properties (spot check a few key fields)
    const budgetProps = structuredProps.budgets.items.properties;
    assert(budgetProps.id, "Budget item should have id field");
    assert(budgetProps.title, "Budget item should have title field");
    assert(budgetProps.spent, "Budget item should have spent field");
    assert(budgetProps.remaining, "Budget item should have remaining field");
    assert(budgetProps.percentage, "Budget item should have percentage field");

    // Verify descriptions exist (documentation-focused)
    assert(
      budgetProps.id.description,
      "id field should have description"
    );
    assert(
      budgetProps.spent.description,
      "spent field should have description"
    );

    console.log("✓ outputSchema correctly exposed in tools/list response");
    console.log(`✓ Budget item has ${Object.keys(budgetProps).length} documented fields`);
  });

  it("should not expose outputSchema for tools without it", async () => {
    const mockPlaidClient = new MockPlaidClient();
    const { server } = createServer(mockPlaidClient as any);
    const serverInternal = server.server as any;
    const toolsHandler = serverInternal._requestHandlers.get("tools/list");

    const result = await toolsHandler({ method: "tools/list", params: {} });

    // Find a tool that shouldn't have outputSchema (e.g., create-budget)
    const createBudgetTool = result.tools.find(
      (t: any) => t.name === "create-budget"
    );

    assert(createBudgetTool, "Should include create-budget tool");

    // Verify it does NOT have outputSchema
    assert.equal(
      createBudgetTool.outputSchema,
      undefined,
      "create-budget should not have outputSchema (not implemented yet)"
    );

    console.log("✓ Tools without outputSchema don't expose it");
  });

  it("should expose outputSchema for get-transactions tool", async () => {
    // Create server with mock Plaid client
    const mockPlaidClient = new MockPlaidClient();
    const { server } = createServer(mockPlaidClient as any);

    // Access the internal tool registry
    const serverInternal = server.server as any;
    const toolsHandler = serverInternal._requestHandlers.get("tools/list");

    assert(toolsHandler, "Server should have tools/list handler");

    // Call the handler directly (bypassing HTTP/auth)
    const result = await toolsHandler({
      method: "tools/list",
      params: {}
    });

    // Find get-transactions tool
    const getTransactionsTool = result.tools.find(
      (t: any) => t.name === "get-transactions"
    );

    assert(getTransactionsTool, "Should include get-transactions tool");

    // CRITICAL: Verify outputSchema field exists
    assert(
      getTransactionsTool.outputSchema,
      "get-transactions tool MUST have outputSchema field"
    );

    // Verify outputSchema structure
    assert.equal(
      getTransactionsTool.outputSchema.type,
      "object",
      "outputSchema should be an object type"
    );

    assert(
      getTransactionsTool.outputSchema.properties,
      "outputSchema should have properties"
    );

    // Verify structuredContent property
    const props = getTransactionsTool.outputSchema.properties;
    assert(props.structuredContent, "Should have structuredContent property");

    // Verify structuredContent has top-level fields
    assert(
      props.structuredContent.properties,
      "structuredContent should have nested properties"
    );

    const structuredProps = props.structuredContent.properties;
    assert(structuredProps.transactions, "Should have transactions array schema");
    assert(structuredProps.summary, "Should have summary schema");
    assert(structuredProps.dataInstructions, "Should have dataInstructions schema");
    assert(structuredProps.visualizationInstructions, "Should have visualizationInstructions schema");

    console.log("✓ outputSchema correctly exposed for get-transactions tool");
    console.log("✓ All top-level fields present in structuredContent");
  });

  it("should expose outputSchema for get-liabilities tool", async () => {
    // Create server with mock Plaid client
    const mockPlaidClient = new MockPlaidClient();
    const { server } = createServer(mockPlaidClient as any);

    // Access the internal tool registry
    const serverInternal = server.server as any;
    const toolsHandler = serverInternal._requestHandlers.get("tools/list");

    assert(toolsHandler, "Server should have tools/list handler");

    // Call the handler directly (bypassing HTTP/auth)
    const result = await toolsHandler({
      method: "tools/list",
      params: {}
    });

    // Find get-liabilities tool
    const getLiabilitiesTool = result.tools.find(
      (t: any) => t.name === "get-liabilities"
    );

    assert(getLiabilitiesTool, "Should include get-liabilities tool");

    // CRITICAL: Verify outputSchema field exists
    assert(
      getLiabilitiesTool.outputSchema,
      "get-liabilities tool MUST have outputSchema field"
    );

    // Verify outputSchema structure
    assert.equal(
      getLiabilitiesTool.outputSchema.type,
      "object",
      "outputSchema should be an object type"
    );

    assert(
      getLiabilitiesTool.outputSchema.properties,
      "outputSchema should have properties"
    );

    // Verify structuredContent property
    const props = getLiabilitiesTool.outputSchema.properties;
    assert(props.structuredContent, "Should have structuredContent property");

    // Verify structuredContent has top-level fields
    assert(
      props.structuredContent.properties,
      "structuredContent should have nested properties"
    );

    const structuredProps = props.structuredContent.properties;
    assert(structuredProps.liabilities, "Should have liabilities array schema");
    assert(structuredProps.summary, "Should have summary schema");
    assert(structuredProps.dataInstructions, "Should have dataInstructions schema");

    console.log("✓ outputSchema correctly exposed for get-liabilities tool");
    console.log("✓ All top-level fields present in structuredContent");
  });

  it("should expose outputSchema for get-investment-holdings tool", async () => {
    // Create server with mock Plaid client
    const mockPlaidClient = new MockPlaidClient();
    const { server } = createServer(mockPlaidClient as any);

    // Access the internal tool registry
    const serverInternal = server.server as any;
    const toolsHandler = serverInternal._requestHandlers.get("tools/list");

    assert(toolsHandler, "Server should have tools/list handler");

    // Call the handler directly (bypassing HTTP/auth)
    const result = await toolsHandler({
      method: "tools/list",
      params: {}
    });

    // Find get-investment-holdings tool
    const getInvestmentHoldingsTool = result.tools.find(
      (t: any) => t.name === "get-investment-holdings"
    );

    assert(getInvestmentHoldingsTool, "Should include get-investment-holdings tool");

    // CRITICAL: Verify outputSchema field exists
    assert(
      getInvestmentHoldingsTool.outputSchema,
      "get-investment-holdings tool MUST have outputSchema field"
    );

    // Verify outputSchema structure
    assert.equal(
      getInvestmentHoldingsTool.outputSchema.type,
      "object",
      "outputSchema should be an object type"
    );

    assert(
      getInvestmentHoldingsTool.outputSchema.properties,
      "outputSchema should have properties"
    );

    // Verify structuredContent property
    const props = getInvestmentHoldingsTool.outputSchema.properties;
    assert(props.structuredContent, "Should have structuredContent property");

    // Verify structuredContent has top-level fields
    assert(
      props.structuredContent.properties,
      "structuredContent should have nested properties"
    );

    const structuredProps = props.structuredContent.properties;
    assert(structuredProps.holdings, "Should have holdings array schema");
    assert(structuredProps.summary, "Should have summary schema");

    console.log("✓ outputSchema correctly exposed for get-investment-holdings tool");
    console.log("✓ All top-level fields present in structuredContent");
  });
});
