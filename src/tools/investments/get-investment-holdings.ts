/**
 * Get Investment Holdings Tool
 * View investment portfolio across all connected investment accounts
 */

import { getHoldingsByUserId } from "../../storage/repositories/investment-holdings.js";

/**
 * Format currency for display
 */
function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format number with commas
 */
function formatNumber(num: number | null): string {
  if (num === null || num === undefined) {
    return "N/A";
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(num);
}

/**
 * Calculate gain/loss percentage
 */
function calculateGainLoss(currentValue: number, costBasis: number | null): {
  amount: number | null;
  percentage: number | null;
} {
  if (!costBasis || costBasis === 0) {
    return { amount: null, percentage: null };
  }

  const amount = currentValue - costBasis;
  const percentage = (amount / costBasis) * 100;

  return { amount, percentage };
}

/**
 * Group holdings by account
 */
function groupByAccount(holdings: any[]): Map<string, any[]> {
  const groups = new Map<string, any[]>();

  for (const holding of holdings) {
    const accountId = holding.account_id;
    if (!groups.has(accountId)) {
      groups.set(accountId, []);
    }
    groups.get(accountId)!.push(holding);
  }

  return groups;
}

/**
 * Handler for get-investment-holdings tool
 */
export async function getInvestmentHoldingsHandler(userId: string) {
  const holdings = await getHoldingsByUserId(userId);

  if (holdings.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: "No investment accounts connected yet. Use connect-account to link your 401k, IRA, brokerage, or crypto exchange accounts.",
        },
      ],
    };
  }

  // Calculate totals
  const totalValue = holdings.reduce((sum, h) => sum + h.institution_value, 0);
  const totalCostBasis = holdings.reduce(
    (sum, h) => sum + (h.cost_basis || 0),
    0
  );
  const totalGainLoss = totalCostBasis > 0 ? totalValue - totalCostBasis : null;
  const totalGainLossPercentage =
    totalCostBasis > 0 ? ((totalValue - totalCostBasis) / totalCostBasis) * 100 : null;

  // Group by account
  const accountGroups = groupByAccount(holdings);

  // Build response text
  let responseText = `# Investment Portfolio\n\n`;
  responseText += `**Total Portfolio Value:** ${formatCurrency(totalValue)}\n`;
  if (totalGainLoss !== null) {
    const sign = totalGainLoss >= 0 ? "+" : "";
    responseText += `**Total Gain/Loss:** ${sign}${formatCurrency(totalGainLoss)} (${sign}${totalGainLossPercentage!.toFixed(2)}%)\n`;
  }
  responseText += `**Accounts:** ${accountGroups.size}\n`;
  responseText += `**Holdings:** ${holdings.length} securities\n\n`;

  // Add holdings by account
  for (const [accountId, accountHoldings] of accountGroups.entries()) {
    const firstHolding = accountHoldings[0];
    const accountName = firstHolding.account_name || "Unknown Account";
    const accountType = firstHolding.account_subtype || firstHolding.account_type || "investment";

    const accountValue = accountHoldings.reduce(
      (sum, h) => sum + h.institution_value,
      0
    );

    responseText += `## ${accountName} (${accountType})\n`;
    responseText += `**Account Value:** ${formatCurrency(accountValue)}\n\n`;

    responseText += `| Security | Quantity | Price | Value | Gain/Loss |\n`;
    responseText += `|----------|----------|-------|-------|----------|\n`;

    for (const holding of accountHoldings) {
      const ticker = holding.ticker_symbol || holding.security_name || "Unknown";
      const quantity = formatNumber(holding.quantity);
      const price = formatCurrency(holding.institution_price);
      const value = formatCurrency(holding.institution_value);

      const { amount, percentage } = calculateGainLoss(
        holding.institution_value,
        holding.cost_basis
      );

      let gainLossStr = "N/A";
      if (amount !== null && percentage !== null) {
        const sign = amount >= 0 ? "+" : "";
        gainLossStr = `${sign}${formatCurrency(amount)} (${sign}${percentage.toFixed(2)}%)`;
      }

      responseText += `| ${ticker} | ${quantity} | ${price} | ${value} | ${gainLossStr} |\n`;
    }

    responseText += `\n`;
  }

  // Build structured content for programmatic access
  const structuredHoldings = holdings.map((h) => {
    const { amount: gainLoss, percentage: gainLossPercentage } = calculateGainLoss(
      h.institution_value,
      h.cost_basis
    );

    return {
      account_id: h.account_id,
      account_name: h.account_name || "Unknown Account",
      account_type: h.account_type,
      account_subtype: h.account_subtype,
      security_id: h.security_id,
      ticker_symbol: h.ticker_symbol,
      security_name: h.security_name,
      security_type: h.security_type,
      security_subtype: h.security_subtype,
      quantity: h.quantity,
      institution_price: h.institution_price,
      institution_price_as_of: h.institution_price_as_of,
      institution_value: h.institution_value,
      cost_basis: h.cost_basis,
      gain_loss: gainLoss,
      gain_loss_percentage: gainLossPercentage,
      iso_currency_code: h.iso_currency_code,
      unofficial_currency_code: h.unofficial_currency_code,
    };
  });

  return {
    content: [
      {
        type: "text",
        text: responseText.trim(),
      },
    ],
    structuredContent: {
      holdings: structuredHoldings,
      summary: {
        totalValue,
        totalCostBasis: totalCostBasis > 0 ? totalCostBasis : null,
        totalGainLoss,
        totalGainLossPercentage,
        accountCount: accountGroups.size,
        holdingCount: holdings.length,
      },
    },
  };
}
