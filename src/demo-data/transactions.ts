import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { DemoTransactionSeedData } from "../storage/demo/transactions.js";

interface ChaseCsvRow {
  "Transaction Date": string;
  "Post Date": string;
  Description: string;
  Category: string;
  Type: string;
  Amount: string;
  Memo: string;
}

function sanitizeUserId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function parseCsvDate(value: string): Date {
  const [month, day, year] = value.split("/").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function loadChaseCsv(): ChaseCsvRow[] {
  const filePath = path.resolve("sandbox", "data", "chasedata.csv");
  const content = fs.readFileSync(filePath, "utf-8");
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

export function buildDemoTransactionSeedData(userId: string): DemoTransactionSeedData {
  const rows = loadChaseCsv();

  if (rows.length === 0) {
    throw new Error("Chase sample data CSV is empty");
  }

  const slug = sanitizeUserId(userId);
  const accountId = `demo_transaction_cc_${slug}`;

  const parsedRows = rows.map((row) => {
    const transactionDate = parseCsvDate(row["Transaction Date"]);
    const postedDate = row["Post Date"] ? parseCsvDate(row["Post Date"]) : transactionDate;
    const rawAmount = Number(row.Amount || "0");
    return {
      raw: row,
      transactionDate,
      postedDate,
      amount: rawAmount,
    };
  });

  const maxDate = parsedRows.reduce(
    (latest, row) => (row.transactionDate > latest ? row.transactionDate : latest),
    parsedRows[0].transactionDate
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const offsetDays = Math.round(
    (today.getTime() - maxDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const paymentOverrides = [5200, 4800, 5250, 4750];
  let paymentIndex = 0;

  const transactions = parsedRows.map((row, index) => {
    const shiftedDate = new Date(row.transactionDate);
    shiftedDate.setDate(shiftedDate.getDate() + offsetDays);
    const shiftedPostedDate = new Date(row.postedDate);
    shiftedPostedDate.setDate(shiftedPostedDate.getDate() + offsetDays);

    let amount = Number.isFinite(row.amount) ? Number(row.amount) : 0;
    let category = row.raw.Category || "General";
    const description = row.raw.Description || "Transaction";

    if (description.toLowerCase().includes("payment thank you")) {
      const override =
        paymentOverrides[
          Math.min(paymentIndex, paymentOverrides.length - 1)
        ];
      paymentIndex += 1;
      amount = override;
      category = "Payments";
    }

    const direction = amount < 0 ? "debit" : "credit";
    const merchant = description.substring(0, 120) || "Merchant";

    return {
      transaction_id: `demo_tx_${slug}_${index}`,
      user_id: userId,
      account_id: accountId,
      date: formatDate(shiftedDate),
      posted_date: formatDate(shiftedPostedDate),
      description,
      merchant_name: merchant,
      category,
      amount: Math.abs(amount),
      direction,
      pending: false,
    };
  });

  const spendingTotal = transactions
    .filter((tx) => tx.direction === "debit")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const paymentsTotal = transactions
    .filter((tx) => tx.direction === "credit")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const currentBalance = spendingTotal - paymentsTotal;
  const creditLimit = 15000;

  return {
    account: {
      account_id: accountId,
      user_id: userId,
      institution_name: "Chase",
      name: "Chase Sapphire Preferred",
      mask: "3842",
      type: "credit",
      subtype: "credit card",
      current_balance: currentBalance,
      currency_code: "USD",
      credit_limit: creditLimit,
      available_credit: creditLimit - currentBalance,
      apr: 19.99,
      minimum_payment: Math.max(50, Math.round(currentBalance * 0.03 * 100) / 100),
      statement_due_date: formatDate(new Date(today.getFullYear(), today.getMonth(), 25)),
      last_synced_at: today.toISOString(),
    },
    transactions,
  };
}
