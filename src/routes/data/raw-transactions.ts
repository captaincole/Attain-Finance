import { Router } from "express";
import { verifySignedToken } from "../../utils/signed-urls.js";
import { userRawTransactionData } from "../../tools/transactions/get-raw-transactions.js";

const router = Router();

router.get("/raw-transactions", (req, res) => {
  const token = req.query.token as string | undefined;

  if (!token) {
    return res.status(400).json({ error: "Missing token parameter" });
  }

  const payload = verifySignedToken(token);

  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  if (payload.resource !== "raw-transactions") {
    return res.status(400).json({ error: "Invalid resource type" });
  }

  const userId = payload.userId;
  const csvData = userRawTransactionData.get(userId);

  if (!csvData) {
    return res.status(404).json({
      error:
        "Raw transaction data not found. Please request transactions first.",
    });
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=raw-transactions.csv"
  );

  res.send(csvData);
  userRawTransactionData.delete(userId);
});

export function createRawTransactionsRouter() {
  return router;
}
