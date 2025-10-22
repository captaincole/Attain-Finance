import { logEvent, serializeError } from "../../utils/logger.js";

/**
 * Structured logging for cron jobs
 * Provides consistent log formatting and error tracking
 */

export interface LogStats {
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  errors: Array<{ context: string; error: string }>;
}

export class CronLogger {
  private jobName: string;
  private startTime: number;
  private stats: LogStats;

  constructor(jobName: string) {
    this.jobName = jobName;
    this.startTime = Date.now();
    this.stats = {
      totalItems: 0,
      successfulItems: 0,
      failedItems: 0,
      errors: [],
    };
  }

  /**
   * Log job start with banner
   */
  logStart(): void {
    logEvent(`CRON:${this.jobName}`, "start", {
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log informational message
   */
  info(message: string): void {
    logEvent(`CRON:${this.jobName}`, "info", { message });
  }

  /**
   * Log warning
   */
  warn(message: string): void {
    logEvent(`CRON:${this.jobName}`, "warn", { message }, "warn");
  }

  /**
   * Log error and track in stats
   */
  error(context: string, error: Error | string): void {
    const serialized = serializeError(error);
    const message =
      typeof serialized.message === "string"
        ? serialized.message
        : JSON.stringify(serialized);
    logEvent(
      `CRON:${this.jobName}`,
      "error",
      { context, error: serialized },
      "error"
    );

    this.stats.errors.push({
      context,
      error: message,
    });
  }

  /**
   * Log success
   */
  success(message: string): void {
    logEvent(`CRON:${this.jobName}`, "success", { message });
  }

  /**
   * Update stats
   */
  updateStats(update: Partial<LogStats>): void {
    this.stats = { ...this.stats, ...update };
  }

  /**
   * Increment counters
   */
  incrementTotal(): void {
    this.stats.totalItems++;
  }

  incrementSuccess(): void {
    this.stats.successfulItems++;
  }

  incrementFailure(): void {
    this.stats.failedItems++;
  }

  /**
   * Get current stats
   */
  getStats(): LogStats {
    return { ...this.stats };
  }

  /**
   * Log final summary with stats
   */
  logSummary(): void {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    logEvent(`CRON:${this.jobName}`, "summary", {
      totalItems: this.stats.totalItems,
      successfulItems: this.stats.successfulItems,
      failedItems: this.stats.failedItems,
      durationSeconds: Number(duration),
      errors: this.stats.errors,
    });
  }

  /**
   * Check if job had any failures
   */
  hasFailures(): boolean {
    return this.stats.failedItems > 0 || this.stats.errors.length > 0;
  }
}
