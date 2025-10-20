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
    console.log("\n╔════════════════════════════════════════════════════╗");
    console.log(`║   ${this.jobName.toUpperCase().padEnd(46)} ║`);
    console.log(`║   ${new Date().toISOString().padEnd(46)} ║`);
    console.log("╚════════════════════════════════════════════════════╝\n");
  }

  /**
   * Log informational message
   */
  info(message: string): void {
    console.log(`[${this.jobName.toUpperCase()}] ${message}`);
  }

  /**
   * Log warning
   */
  warn(message: string): void {
    console.warn(`[${this.jobName.toUpperCase()}] ⚠️  ${message}`);
  }

  /**
   * Log error and track in stats
   */
  error(context: string, error: Error | string): void {
    const errorMessage = error instanceof Error ? error.message : error;
    console.error(`[${this.jobName.toUpperCase()}] ✗ ${context}: ${errorMessage}`);

    this.stats.errors.push({
      context,
      error: errorMessage,
    });
  }

  /**
   * Log success
   */
  success(message: string): void {
    console.log(`[${this.jobName.toUpperCase()}] ✓ ${message}`);
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

    console.log("\n╔════════════════════════════════════════════════════╗");
    console.log("║   SUMMARY                                         ║");
    console.log("╚════════════════════════════════════════════════════╝");
    console.log(`\n📊 Results:`);
    console.log(`   Total items:        ${this.stats.totalItems}`);
    console.log(`   Successful items:   ${this.stats.successfulItems}`);
    console.log(`   Failed items:       ${this.stats.failedItems}`);
    console.log(`\n⏱️  Duration: ${duration}s`);

    if (this.stats.errors.length > 0) {
      console.log(`\n❌ Errors (${this.stats.errors.length}):`);
      this.stats.errors.forEach((err, idx) => {
        console.log(`   ${idx + 1}. ${err.context}`);
        console.log(`      ${err.error}`);
      });
    }

    console.log("\n" + "═".repeat(52) + "\n");
  }

  /**
   * Check if job had any failures
   */
  hasFailures(): boolean {
    return this.stats.failedItems > 0 || this.stats.errors.length > 0;
  }
}
