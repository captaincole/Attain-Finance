import fs from "fs";
import path from "path";
import { Router } from "express";
import { fileURLToPath } from "url";
import { verifySignedToken } from "../../utils/signed-urls.js";
import { userTransactionData } from "../../tools/transactions/get-transactions.js";
import { logRouteEvent, serializeError } from "../../utils/logger.js";

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..", "..", "..");
const transactionsCsvPath = path.join(
  projectRoot,
  "public",
  "transactions.csv"
);

router.get("/transactions", (req, res) => {
  const token = req.query.token as string | undefined;

  if (!token) {
    return res.status(400).json({ error: "Missing token parameter" });
  }

  const payload = verifySignedToken(token);

  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  if (payload.resource !== "transactions") {
    return res.status(400).json({ error: "Invalid resource type" });
  }

  const userId = payload.userId;
  const csvData = userTransactionData.get(userId);

  if (csvData) {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=transactions.csv"
    );

    res.send(csvData);
    userTransactionData.delete(userId);
    return;
  }

  if (!fs.existsSync(transactionsCsvPath)) {
    return res.status(404).json({ error: "Transaction data not found" });
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=transactions.csv");

  const fileStream = fs.createReadStream(transactionsCsvPath);
  fileStream.pipe(res);

  fileStream.on("error", (error) => {
    logRouteEvent(
      "transactions-download",
      "stream-error",
      { error: serializeError(error) },
      "error"
    );

    if (!res.headersSent) {
      res.status(500).json({ error: "Error streaming file" });
    }
  });
});

export function createTransactionsDataRouter() {
  return router;
}
