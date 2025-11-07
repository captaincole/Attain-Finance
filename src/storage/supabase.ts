import { createClient, SupabaseClient } from "@supabase/supabase-js";
import jwt, { JwtPayload } from "jsonwebtoken";
import { Database } from "./database.types.js";
import { logEvent } from "../utils/logger.js";

type SupabaseEnvKey =
  | "SUPABASE_URL"
  | "SUPABASE_PUBLISHABLE_KEY"
  | "SUPABASE_SECRET_KEY";

type SupabaseMockScope = "default" | "service" | "user";

interface SupabaseEnvironment {
  url: string;
  publishableKey: string;
  secretKey: string;
}

interface CachedUserClient {
  client: SupabaseClient<Database>;
  expiresAt?: number;
}

interface GeneratedUserToken {
  token: string;
  expiresAt?: number;
}

const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

const envCache = new Map<SupabaseEnvKey, string>();
let publishableClient: SupabaseClient<Database> | null = null;
let serviceClient: SupabaseClient<Database> | null = null;
const userClients = new Map<string, CachedUserClient>();

function isCacheEntryExpired(entry: CachedUserClient): boolean {
  if (!entry.expiresAt || !Number.isFinite(entry.expiresAt)) {
    return false;
  }

  return entry.expiresAt - TOKEN_REFRESH_BUFFER_MS <= Date.now();
}

function getCachedUserClient(userId: string): CachedUserClient | undefined {
  const cached = userClients.get(userId);

  if (!cached) {
    return undefined;
  }

  if (isCacheEntryExpired(cached)) {
    userClients.delete(userId);
    return undefined;
  }

  return cached;
}

function cacheUserClient(
  userId: string,
  client: SupabaseClient<Database>,
  expiresAt?: number
) {
  userClients.set(userId, { client, expiresAt });
}

function decodeTokenExpiration(token: string): number | undefined {
  try {
    const decoded = jwt.decode(token) as JwtPayload | null;
    if (decoded && typeof decoded.exp === "number") {
      return decoded.exp * 1000;
    }
  } catch {
    // ignore decode failures and fall back to undefined
  }

  return undefined;
}

/**
 * Internal helper to load and cache environment variables.
 */
function requireEnv(key: SupabaseEnvKey): string {
  if (envCache.has(key)) {
    return envCache.get(key)!;
  }

  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${key}. Please add it to your environment or .env file.`
    );
  }

  envCache.set(key, value);
  return value;
}

/**
 * Return the Supabase environment values once, throwing if any are missing.
 * Useful for validation in bootstrapping or tests.
 */
export function getSupabaseEnvironment(): SupabaseEnvironment {
  return {
    url: requireEnv("SUPABASE_URL"),
    publishableKey: requireEnv("SUPABASE_PUBLISHABLE_KEY"),
    secretKey: requireEnv("SUPABASE_SECRET_KEY"),
  };
}

export function getSupabaseUrl(): string {
  return requireEnv("SUPABASE_URL");
}

export function getSupabasePublishableKey(): string {
  return requireEnv("SUPABASE_PUBLISHABLE_KEY");
}

export function getSupabaseSecretKey(): string {
  return requireEnv("SUPABASE_SECRET_KEY");
}

/**
 * Reset cached clients and environment values.
 * Primarily used in tests to ensure clean isolation between cases.
 */
export function resetSupabase() {
  publishableClient = null;
  serviceClient = null;
  userClients.clear();
  envCache.clear();
}

/**
 * Allow tests to inject mocked clients.
 */
export function setSupabaseMock(
  mockInstance: SupabaseClient<Database>,
  options?: { scope?: SupabaseMockScope; userId?: string }
) {
  const scope = options?.scope ?? "default";

  if (scope === "service") {
    serviceClient = mockInstance;
    return;
  }

  if (scope === "user") {
    if (!options?.userId) {
      throw new Error("userId is required when setting a user-scoped Supabase mock.");
    }
    cacheUserClient(options.userId, mockInstance, Number.POSITIVE_INFINITY);
    return;
  }

  publishableClient = mockInstance;
}

/**
 * Publishable client without user context.
 * Prefer getSupabaseForUser whenever you have a specific user ID.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (publishableClient) {
    return publishableClient;
  }

  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_PUBLISHABLE_KEY");

  publishableClient = createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return publishableClient;
}

/**
 * Create or return a user-scoped client that injects the x-user-id header.
 * Useful for any user-specific queries performed with the publishable key.
 */
export function getSupabaseForUser(userId: string): SupabaseClient<Database> {
  if (!userId) {
    throw new Error("User ID is required to create a user-scoped Supabase client.");
  }

  const cachedClient = getCachedUserClient(userId);
  if (cachedClient) {
    return cachedClient.client;
  }

  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_PUBLISHABLE_KEY");

  const { token: bearerToken, expiresAt } = generateUserSupabaseToken(userId);

  const headers: Record<string, string> = {
    "x-user-id": userId,
    "X-User-Id": userId,
  };

  headers.Authorization = `Bearer ${bearerToken}`;

  const client = createClient<Database>(url, key, {
    global: {
      headers,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  logEvent("SUPABASE", "create-user-client", {
    userId,
    tokenSource: "generated",
    expiresAt,
  });

  cacheUserClient(userId, client, expiresAt);

  return client;
}

export function invalidateSupabaseUserClient(userId: string) {
  userClients.delete(userId);
}

export function refreshSupabaseUserClient(userId: string): SupabaseClient<Database> {
  invalidateSupabaseUserClient(userId);
  return getSupabaseForUser(userId);
}

export async function withUserSupabaseRetry<T>(
  userId: string,
  operation: (client: SupabaseClient<Database>) => Promise<T>,
  options?: { supabaseClient?: SupabaseClient<Database> }
): Promise<T> {
  const providedClient = options?.supabaseClient;
  const initialClient = providedClient ?? getSupabaseForUser(userId);

  try {
    return await operation(initialClient);
  } catch (error) {
    if (providedClient || !isJwtExpiredError(error)) {
      throw error;
    }

    logEvent("SUPABASE", "refresh-user-client", {
      userId,
      reason: extractErrorMessage(error),
    });

    const refreshedClient = refreshSupabaseUserClient(userId);
    return operation(refreshedClient);
  }
}

function extractErrorMessage(error: unknown): string | undefined {
  if (!error) {
    return undefined;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") {
      return maybeMessage;
    }
  }

  return undefined;
}

function isJwtExpiredError(error: unknown): boolean {
  const message = extractErrorMessage(error);
  if (!message) {
    return false;
  }

  return message.toLowerCase().includes("jwt expired");
}

function generateUserSupabaseToken(userId: string): GeneratedUserToken {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret || jwtSecret === "replace-with-your-supabase-jwt-secret") {
    throw new Error(
      "SUPABASE_JWT_SECRET is required (set it to the value from Supabase Project Settings → API)."
    );
  }

  const token = jwt.sign(
    {
      sub: userId,
      role: "authenticated",
      iss: "personal-finance-mcp",
      aud: "authenticated",
    },
    jwtSecret,
    { expiresIn: "6h" }
  );

  return {
    token,
    expiresAt: decodeTokenExpiration(token),
  };
}

/**
 * Service role client with full access. Only use for trusted server-side jobs.
 */
export function getSupabaseServiceRole(): SupabaseClient<Database> {
  if (serviceClient) {
    return serviceClient;
  }

  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SECRET_KEY");

  serviceClient = createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return serviceClient;
}
