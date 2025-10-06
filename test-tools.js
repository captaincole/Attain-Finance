// Quick test to verify tools are registered
import { createServer } from './build/create-server.js';

// Mock Plaid client and storage
const mockPlaidClient = {};
const mockPendingConnections = new Map();
const mockUserPlaidTokens = new Map();

const { server } = createServer(
  mockPlaidClient,
  mockPendingConnections,
  mockUserPlaidTokens
);

// List all tools
const tools = await server.listTools();

console.log('\n=== Registered MCP Tools ===\n');
tools.tools.forEach((tool, index) => {
  console.log(`${index + 1}. ${tool.name}`);
  console.log(`   Description: ${tool.description}`);
  console.log('');
});

console.log(`Total tools: ${tools.tools.length}`);
