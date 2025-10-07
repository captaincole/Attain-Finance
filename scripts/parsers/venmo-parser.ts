import fs from "fs";
import { parse } from "csv-parse/sync";
import type { StandardTransaction, CSVParser } from "./types.js";

/**
 * Venmo CSV Parser
 *
 * Format:
 * - First 4 lines are headers/metadata
 * - Line 5+ are actual transactions
 * - Columns: ID,Datetime,Type,Status,Note,From,To,Amount (total),...
 * - Amounts have "$" and sign (e.g., "- $191.38", "+ $189.00")
 * - Type can be "Charge" (received) or "Payment" (sent)
 * - Datetime format: 2025-08-01T21:56:49
 */
export class VenmoParser implements CSVParser {
  async parse(filePath: string): Promise<StandardTransaction[]>;
  async parse(filePaths: string[]): Promise<StandardTransaction[]>;
  async parse(filePathOrPaths: string | string[]): Promise<StandardTransaction[]> {
    const filePaths = Array.isArray(filePathOrPaths)
      ? filePathOrPaths
      : [filePathOrPaths];

    const allTransactions: StandardTransaction[] = [];

    for (const filePath of filePaths) {
      const transactions = await this.parseFile(filePath);
      allTransactions.push(...transactions);
    }

    // Sort by date
    allTransactions.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });

    return allTransactions;
  }

  private async parseFile(filePath: string): Promise<StandardTransaction[]> {
    const fileContent = fs.readFileSync(filePath, "utf-8");

    // Parse entire file
    const allRecords = parse(fileContent, {
      skip_empty_lines: true,
      relax_column_count: true,
    });

    // Find where transactions start (after row 4, which is index 3)
    const transactionRecords = allRecords.slice(4);

    const transactions: StandardTransaction[] = [];

    for (const record of transactionRecords) {
      // Venmo format has empty first column, then:
      // [0]="", [1]=ID, [2]=Datetime, [3]=Type, [4]=Status, [5]=Note,
      // [6]=From, [7]=To, [8]=Amount (total)
      if (record.length < 9) continue;

      const datetime = record[2];
      const type = record[3];
      const note = record[5];
      const from = record[6];
      const to = record[7];
      const amountStr = record[8];

      // Skip if no datetime or amount
      if (!datetime || !amountStr) continue;

      // Parse date from datetime (2025-08-01T21:56:49 -> 2025-08-01)
      const date = datetime.split("T")[0];
      if (!date) continue;

      // Parse amount (remove "$", spaces, convert sign)
      const amount = this.parseAmount(amountStr);
      if (amount === null) continue;

      // Build description from note, from, and to
      const description = this.buildDescription(type, note, from, to);

      transactions.push({
        date,
        description,
        amount,
        category: "Transfer", // Venmo transactions are transfers
      });
    }

    return transactions;
  }

  /**
   * Parse Venmo amount string to number
   * "- $191.38" -> -191.38 (money out)
   * "+ $189.00" -> 189.00 (money in)
   */
  private parseAmount(amountStr: string): number | null {
    if (!amountStr) return null;

    // Remove "$" and spaces
    const cleaned = amountStr.replace(/\$/g, "").replace(/\s+/g, "").trim();
    if (!cleaned) return null;

    const amount = parseFloat(cleaned);
    return isNaN(amount) ? null : amount;
  }

  /**
   * Build readable description from transaction fields
   */
  private buildDescription(
    type: string,
    note: string,
    from: string,
    to: string
  ): string {
    const isPayment = type === "Payment";
    const counterparty = isPayment ? to : from;

    if (note && note.trim()) {
      return `${note} (${counterparty})`;
    }

    return `Venmo ${isPayment ? "to" : "from"} ${counterparty}`;
  }
}
