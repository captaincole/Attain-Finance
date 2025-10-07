import fs from "fs";
import { parse } from "csv-parse/sync";
import type { StandardTransaction, CSVParser } from "./types.js";

/**
 * Bank of America CSV Parser
 *
 * Format:
 * - First 6 lines are summary data
 * - Line 7 has column headers: Date,Description,Amount,Running Bal.
 * - Transactions start at line 8
 * - Amounts include commas and quotes (e.g., "10,032.31")
 * - Negative amounts start with "-" (e.g., "-4,199.56")
 */
export class BofAParser implements CSVParser {
  async parse(filePath: string): Promise<StandardTransaction[]> {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const lines = fileContent.split("\n");

    // Skip first 7 lines (summary + header)
    const transactionLines = lines.slice(7).join("\n");

    // Parse all transactions at once with proper CSV handling
    const records = parse(transactionLines, {
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true, // Allow quotes in quotes
      escape: '"',
      quote: '"',
    });

    const transactions: StandardTransaction[] = [];

    for (const record of records) {
      if (record.length < 3) continue;

      const [date, description, amountStr] = record;

      // Skip the "Beginning balance" line
      if (description && description.includes("Beginning balance")) continue;

      // Parse date (format: MM/DD/YYYY)
      const parsedDate = this.parseDate(date);
      if (!parsedDate) continue;

      // Parse amount (remove quotes, commas, convert to number)
      const amount = this.parseAmount(amountStr);
      if (amount === null) continue;

      transactions.push({
        date: parsedDate,
        description: description.trim(),
        amount,
      });
    }

    return transactions;
  }

  /**
   * Convert MM/DD/YYYY to YYYY-MM-DD
   */
  private parseDate(dateStr: string): string | null {
    if (!dateStr) return null;

    const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return null;

    const [, month, day, year] = match;
    return `${year}-${month}-${day}`;
  }

  /**
   * Parse amount string to number
   * Handles: "10,032.31" -> 10032.31
   *          "-4,199.56" -> -4199.56
   */
  private parseAmount(amountStr: string): number | null {
    if (!amountStr) return null;

    // Remove quotes and commas
    const cleaned = amountStr.replace(/[",]/g, "").trim();
    if (!cleaned) return null;

    const amount = parseFloat(cleaned);
    return isNaN(amount) ? null : amount;
  }
}
