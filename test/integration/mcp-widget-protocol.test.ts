/**
 * Integration tests for MCP widget protocol (OpenAI extensions)
 * Tests that tools/list returns correct _meta fields for widget-enabled tools
 * Tests that resources/read returns widget HTML correctly
 * Tests that tools/call returns structuredContent for widgets
 */

import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert";
import request from "supertest";

// Set test environment BEFORE importing anything
process.env.NODE_ENV = "test";
process.env.ENCRYPTION_KEY = "a".repeat(64);
process.env.JWT_SECRET = "b".repeat(64);
process.env.BASE_URL = "http://localhost:3000";

// Load real Clerk test keys from .env file
import dotenv from "dotenv";
dotenv.config();

// Mock external dependencies
import { setSupabaseMock, resetSupabase } from "../../src/storage/supabase.js";
import { createTestSupabaseClient, cleanupTestUser } from "../helpers/test-db.js";

// Import app after environment is set up
import { app } from "../../src/index.js";

describe("MCP Widget Protocol (OpenAI Extensions)", () => {
  const supabase = createTestSupabaseClient();
  const testUserId = "test-user-widget-protocol";

  before(() => {
    setSupabaseMock(supabase);
  });

  beforeEach(async () => {
    await cleanupTestUser(supabase, testUserId);
  });

  after(async () => {
    await cleanupTestUser(supabase, testUserId);
    resetSupabase();
  });

});
