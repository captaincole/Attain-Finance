type LogLevel = "info" | "warn" | "error";

export interface SerializedError {
  message: string;
  stack?: string;
  name?: string;
  [key: string]: unknown;
}

interface LogOptions {
  level?: LogLevel;
  data?: Record<string, unknown>;
}

/**
 * Safely extract a user ID preview from log data
 */
function getUserIdPreview(data?: Record<string, unknown>): string | undefined {
  if (!data) {
    return undefined;
  }

  const candidateKeys = ["userId", "user_id", "userID"];
  for (const key of candidateKeys) {
    const value = data[key];
    if (typeof value === "string" && value.length > 0) {
      const normalized = value.startsWith("user_") ? value.slice(5) : value;
      if (normalized.length > 0) {
        return normalized.slice(0, 5);
      }
    }
  }

  return undefined;
}

/**
 * Clone and normalize log data with user ID preview
 */
function sanitizeLogData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!data || Object.keys(data).length === 0) {
    return data;
  }

  const sanitized: Record<string, unknown> = { ...data };
  const userIdPreview = getUserIdPreview(data);

  if (userIdPreview) {
    sanitized.userId = userIdPreview;
  }

  return sanitized;
}

/**
 * Serialize data for consistent log output
 */
function formatData(data?: Record<string, unknown>): string {
  const sanitized = sanitizeLogData(data);

  if (!sanitized || Object.keys(sanitized).length === 0) {
    return "";
  }

  try {
    return ` ${JSON.stringify(sanitized)}`;
  } catch (error) {
    return ` {"serializationError":"${(error as Error).message}"}`;
  }
}

/**
 * Core logger implementation
 */
function log(scope: string, event: string, { level = "info", data }: LogOptions = {}) {
  const message = `[${scope}] ${event}${formatData(data)}`;

  switch (level) {
    case "warn":
      console.warn(message);
      break;
    case "error":
      console.error(message);
      break;
    default:
      console.log(message);
  }
}

export function logToolEvent(toolName: string, event: string, data?: Record<string, unknown>, level: LogLevel = "info") {
  log(`TOOL:${toolName}`, event, { level, data });
}

export function logServiceEvent(serviceName: string, event: string, data?: Record<string, unknown>, level: LogLevel = "info") {
  log(`SERVICE:${serviceName}`, event, { level, data });
}

export function logRouteEvent(routeName: string, event: string, data?: Record<string, unknown>, level: LogLevel = "info") {
  log(`ROUTE:${routeName}`, event, { level, data });
}

export function logEvent(scope: string, event: string, data?: Record<string, unknown>, level: LogLevel = "info") {
  log(scope, event, { level, data });
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
    };
  }

  return {
    message: String(error),
  };
}

/**
 * Batch operation result tracking
 */
export interface BatchResult {
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  durationSeconds: number;
  errors: Array<{ context: string; error: string }>;
}

/**
 * Execute a batch operation with automatic logging and stats tracking
 * Logs start, progress, and summary with duration and success/failure counts
 *
 * @param scope - Log scope (e.g., "CRON:sync-transactions")
 * @param items - Array of items to process
 * @param operation - Async function that processes each item, returns success status
 * @returns BatchResult with statistics
 *
 * @example
 * const result = await logBatchOperation("CRON:sync-users", userIds, async (userId) => {
 *   try {
 *     await syncUser(userId);
 *     return { success: true };
 *   } catch (error) {
 *     return { success: false, context: userId, error };
 *   }
 * });
 *
 * if (result.failedItems > 0) {
 *   process.exit(1);
 * }
 */
export async function logBatchOperation<T>(
  scope: string,
  items: T[],
  operation: (item: T, index: number) => Promise<{ success: boolean; context?: string; error?: unknown }>
): Promise<BatchResult> {
  const startTime = Date.now();

  logEvent(scope, "start", {
    timestamp: new Date().toISOString(),
    totalItems: items.length,
  });

  const result: BatchResult = {
    totalItems: items.length,
    successfulItems: 0,
    failedItems: 0,
    durationSeconds: 0,
    errors: [],
  };

  for (const [index, item] of items.entries()) {
    const opResult = await operation(item, index);

    if (opResult.success) {
      result.successfulItems++;
    } else {
      result.failedItems++;
      if (opResult.error) {
        const serialized = serializeError(opResult.error);
        result.errors.push({
          context: opResult.context || `item ${index}`,
          error: serialized.message,
        });
      }
    }
  }

  result.durationSeconds = Number(((Date.now() - startTime) / 1000).toFixed(2));

  logEvent(scope, "summary", {
    totalItems: result.totalItems,
    successfulItems: result.successfulItems,
    failedItems: result.failedItems,
    durationSeconds: result.durationSeconds,
    errors: result.errors,
  });

  return result;
}
