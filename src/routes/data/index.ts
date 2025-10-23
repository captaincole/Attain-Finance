import { Router } from "express";
import { createTransactionsDataRouter } from "./transactions.js";
import { createRawTransactionsRouter } from "./raw-transactions.js";

export function createDataRouter() {
  const router = Router();

  router.use(createTransactionsDataRouter());
  router.use(createRawTransactionsRouter());

  return router;
}
