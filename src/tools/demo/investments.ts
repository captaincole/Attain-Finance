import type { ToolDefinition } from "../types.js";
import { getDemoInvestmentSnapshot } from "../../storage/demo/investments.js";
import { getAccountsByUserId } from "../../storage/repositories/accounts.js";
import { logToolEvent, serializeError } from "../../utils/logger.js";
import { DEMO_SECURITY_IDS } from "../../demo-data/investments.js";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function getInvestmentsTool(): ToolDefinition {
  return {
    name: "get-investments",
    description:
      "View the demo investment portfolio alongside your real connected accounts. Returns a Plaid-shaped response containing the demo brokerage account, holdings (cash + GOOG), and any linked credit card accounts to show combined activity.",
    inputSchema: {},
    options: {
      readOnlyHint: true,
      securitySchemes: [{ type: "oauth2" }],
    },
    handler: async (_args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;

      if (!userId) {
        throw new Error("User authentication required");
      }

      try {
        const [snapshot, accounts] = await Promise.all([
          getDemoInvestmentSnapshot(userId),
          getAccountsByUserId(userId),
        ]);

        const creditAccounts = accounts.filter(
          (account) => account.type === "credit"
        );

        const demoAccount = snapshot.accounts[0];
        const googHolding = snapshot.holdings.find(
          (holding) => holding.security_id === DEMO_SECURITY_IDS.goog
        );
        const cashHolding = snapshot.holdings.find(
          (holding) => holding.security_id === DEMO_SECURITY_IDS.cashUsd
        );

        const textSections: string[] = [];

        if (creditAccounts.length > 0) {
          textSections.push("**Connected Credit Accounts**");
          creditAccounts.forEach((account) => {
            const balance =
              typeof account.current_balance === "number"
                ? formatCurrency(Number(account.current_balance))
                : "N/A";
            textSections.push(
              `• ${account.name}${
                account.subtype ? ` (${account.subtype})` : ""
              }: ${balance}`
            );
          });
        } else {
          textSections.push(
            "⚠️ No credit accounts are currently linked. Use `connect-account` to link a real Chase credit card."
          );
        }

        if (demoAccount) {
          textSections.push("\n**Brokerage Portfolio**");
          textSections.push(
            `${demoAccount.name}${
              demoAccount.mask ? ` ••••${demoAccount.mask}` : ""
            } → Total Value ${formatCurrency(snapshot.totals.totalValue)}`
          );
          textSections.push(
            `• Cash on hand: ${
              cashHolding
                ? formatCurrency(cashHolding.institution_value)
                : formatCurrency(0)
            }`
          );
          if (googHolding) {
            const price = googHolding.institution_price ?? 0;
            textSections.push(
              `• GOOG: ${googHolding.quantity} shares @ ${formatCurrency(
                price
              )} (${formatCurrency(googHolding.institution_value)})`
            );
          }
        } else {
          textSections.push(
            "⚠️ Brokerage data not found. Run `npm run demo:seed -- --userId=<id>` to populate investments."
          );
        }

        const responseText = textSections.join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: responseText,
            },
          ],
          structuredContent: {
            accounts: snapshot.accounts.map((account) => ({
              account_id: account.account_id,
              mask: account.mask,
              name: account.name,
              official_name: null,
              type: account.type,
              subtype: account.subtype,
              balances: {
                available: account.balances_available,
                current: account.balances_current,
                iso_currency_code: account.currency_code || "USD",
                limit: null,
                unofficial_currency_code: null,
              },
              last_synced_at: account.last_synced_at,
            })),
            holdings: snapshot.holdings.map((holding) => ({
              account_id: holding.account_id,
              security_id: holding.security_id,
              quantity: holding.quantity,
              cost_basis: holding.cost_basis,
              institution_price: holding.institution_price,
              institution_price_as_of: holding.institution_price_as_of,
              institution_value: holding.institution_value,
              iso_currency_code: holding.currency_code || "USD",
            })),
            securities: snapshot.securities,
            totals: snapshot.totals,
            linkedCreditAccounts: creditAccounts.map((account) => ({
              account_id: account.account_id,
              item_id: account.item_id,
              name: account.name,
              type: account.type,
              subtype: account.subtype,
              current_balance: account.current_balance,
              available_balance: account.available_balance,
              limit_amount: account.limit_amount,
              currency_code: account.currency_code,
              last_synced_at: account.last_synced_at,
            })),
          },
        };
      } catch (error) {
        logToolEvent(
          "get-investments",
          "handler-error",
          { error: serializeError(error) },
          "error"
        );
        throw error;
      }
    },
  };
}
