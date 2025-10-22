type LogLevel = "info" | "warn" | "error";

interface LogOptions {
  level?: LogLevel;
  data?: Record<string, unknown>;
}

/**
 * Serialize data for consistent log output
 */
function formatData(data?: Record<string, unknown>): string {
  if (!data || Object.keys(data).length === 0) {
    return "";
  }

  try {
    return ` ${JSON.stringify(data)}`;
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

export function serializeError(error: unknown): Record<string, unknown> {
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
