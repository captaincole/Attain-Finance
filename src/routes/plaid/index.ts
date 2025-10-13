/**
 * Plaid Routes
 * Express routes for Plaid Link UI and callback handling
 */

import { Router } from "express";
import { PlaidApi } from "plaid";
import { plaidLinkHandler } from "./link-ui.js";
import { plaidCallbackHandler } from "./callback.js";

/**
 * Create Plaid router with Link UI and callback endpoints
 */
export function createPlaidRouter(plaidClient: PlaidApi): Router {
  const router = Router();

  // GET /plaid/link - Plaid Link UI page
  router.get("/link", plaidLinkHandler);

  // POST /plaid/callback - Token exchange callback
  router.post("/callback", (req, res) => plaidCallbackHandler(req, res, plaidClient));

  return router;
}
