import fs from "fs";
import { parse } from "csv-parse/sync";
import type { StandardTransaction, CSVParser } from "./types.js";

/**
 * Chase Credit Card CSV Parser
 *
 * Format:
 * Transaction Date,Post Date,Description,Category,Type,Amount,Memo
 * 10/04/2025,10/05/2025,CURSOR  AI POWERED IDE,Shopping,Sale,-20.00,
 *
 * All amounts are negative (credit card charges)
 * Has category information we can preserve
 */
export class ChaseParser implements CSVParser {
  private maxTransactions: number;

  constructor(maxTransactions: number = 150) {
    this.maxTransactions = maxTransactions;
  }

  async parse(filePath: string): Promise<StandardTransaction[]> {
    const fileContent = fs.readFileSync(filePath, "utf-8");

    const records = parse(fileContent, {
      columns: true, // Use first row as headers
      skip_empty_lines: true,
      trim: true,
    });

    const transactions: StandardTransaction[] = [];

    for (const record of records) {
      const transactionDate = record["Transaction Date"];
      const description = record["Description"];
      const category = record["Category"];
      const amountStr = record["Amount"];

      // Parse date (format: MM/DD/YYYY)
      const parsedDate = this.parseDate(transactionDate);
      if (!parsedDate) continue;

      // Parse amount
      const amount = parseFloat(amountStr);
      if (isNaN(amount)) continue;

      transactions.push({
        date: parsedDate,
        description: description.trim(),
        amount,
        category: category || undefined,
      });
    }

    // Sort by date (newest first) and limit to maxTransactions
    transactions.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB.getTime() - dateA.getTime();
    });

    const limited = transactions.slice(0, this.maxTransactions);

    console.log(
      `Chase: Parsed ${transactions.length} transactions, kept most recent ${limited.length}`
    );

    return limited;
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
}
