/**
 * Get Liabilities Tool
 * View credit cards, mortgages, and student loans across all connected accounts
 */

import { PlaidApi } from "plaid";
import {
  getLiabilitiesByUserId,
  upsertCreditLiabilities,
  upsertMortgageLiabilities,
  upsertStudentLiabilities,
  type LiabilityWithAccount,
} from "../../storage/repositories/liabilities.js";
import { getUserConnections } from "../../services/account-service.js";
import { logToolEvent } from "../../utils/logger.js";

/**
 * Format currency for display
 */
function formatCurrency(amount: number | null | undefined): string {
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
 * Format date for display
 */
function formatDate(date: string | null | undefined): string {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("en-US");
}

/**
 * Format APR data for credit cards
 */
function formatAprs(aprs: any): string {
  if (!aprs || !Array.isArray(aprs) || aprs.length === 0) {
    return "N/A";
  }

  return aprs
    .map((apr: any) => {
      const percentage = apr.apr_percentage ? `${apr.apr_percentage.toFixed(2)}%` : "N/A";
      const type = apr.apr_type || "Unknown";
      return `${type}: ${percentage}`;
    })
    .join(", ");
}

/**
 * Handler for get-liabilities tool
 */
export async function getLiabilitiesHandler(
  userId: string,
  type?: "credit" | "mortgage" | "student",
  plaidClient?: PlaidApi
) {
  logToolEvent("get-liabilities", "start", { userId, type });

  // First, try to get liabilities from database
  let liabilities = await getLiabilitiesByUserId(userId, type);

  // If no data in database, fetch from Plaid
  if (liabilities.length === 0 && plaidClient) {
    logToolEvent("get-liabilities", "no-data-fetching-from-plaid", { userId });

    try {
      const connections = await getUserConnections(userId);

      for (const connection of connections) {
        try {
          // getUserConnections already returns decrypted access tokens
          const accessToken = connection.accessToken;

          // Fetch liabilities from Plaid
          const response = await plaidClient.liabilitiesGet({
            access_token: accessToken,
          });

          const { liabilities: plaidLiabilities } = response.data;

          // Process credit card liabilities
          if (plaidLiabilities.credit) {
            for (const credit of plaidLiabilities.credit) {
              if (credit.account_id) {
                await upsertCreditLiabilities(userId, credit.account_id, credit);
              }
            }
          }

          // Process mortgage liabilities
          if (plaidLiabilities.mortgage) {
            for (const mortgage of plaidLiabilities.mortgage) {
              await upsertMortgageLiabilities(userId, mortgage.account_id, mortgage);
            }
          }

          // Process student loan liabilities
          if (plaidLiabilities.student) {
            for (const student of plaidLiabilities.student) {
              if (student.account_id) {
                await upsertStudentLiabilities(userId, student.account_id, student);
              }
            }
          }

          logToolEvent("get-liabilities", "plaid-sync-complete", {
            userId,
            itemId: connection.itemId,
            creditCount: plaidLiabilities.credit?.length || 0,
            mortgageCount: plaidLiabilities.mortgage?.length || 0,
            studentCount: plaidLiabilities.student?.length || 0,
          });
        } catch (error: any) {
          logToolEvent(
            "get-liabilities",
            "plaid-sync-error",
            { userId, itemId: connection.itemId, error: error.message },
            "error"
          );
          // Continue to next connection
        }
      }

      // Fetch updated liabilities from database
      liabilities = await getLiabilitiesByUserId(userId, type);
    } catch (error: any) {
      logToolEvent(
        "get-liabilities",
        "error",
        { userId, error: error.message },
        "error"
      );
      return {
        content: [
          {
            type: "text",
            text: `❌ **Error Fetching Liabilities**\n\nFailed to fetch liabilities: ${error.message}`,
          },
        ],
      };
    }
  }

  // If still no liabilities found
  if (liabilities.length === 0) {
    const typeFilter = type ? ` ${type}` : "";
    return {
      content: [
        {
          type: "text",
          text: `No${typeFilter} liabilities found. Make sure you have connected accounts with credit cards, mortgages, or student loans.`,
        },
      ],
    };
  }

  // Group by type
  const creditLiabilities = liabilities.filter((l) => l.type === "credit");
  const mortgageLiabilities = liabilities.filter((l) => l.type === "mortgage");
  const studentLiabilities = liabilities.filter((l) => l.type === "student");

  // Build response text
  let responseText = `# Liabilities Overview\n\n`;
  responseText += `**Total Liabilities:** ${liabilities.length}\n`;
  if (!type) {
    responseText += `- Credit Cards: ${creditLiabilities.length}\n`;
    responseText += `- Mortgages: ${mortgageLiabilities.length}\n`;
    responseText += `- Student Loans: ${studentLiabilities.length}\n`;
  }
  responseText += `\n`;

  // Credit Cards Section
  if (creditLiabilities.length > 0 && (!type || type === "credit")) {
    responseText += `## Credit Cards (${creditLiabilities.length})\n\n`;

    for (const liability of creditLiabilities) {
      const data = liability.data as any;
      responseText += `### ${liability.account_name || "Unknown Account"}\n`;
      responseText += `- **Last Statement Balance:** ${formatCurrency(data.last_statement_balance)}\n`;
      responseText += `- **Minimum Payment:** ${formatCurrency(data.minimum_payment_amount)}\n`;
      responseText += `- **Next Payment Due:** ${formatDate(data.next_payment_due_date)}\n`;
      responseText += `- **APRs:** ${formatAprs(data.aprs)}\n`;
      responseText += `- **Overdue:** ${data.is_overdue ? "Yes ⚠️" : "No"}\n`;
      if (data.last_payment_date) {
        responseText += `- **Last Payment:** ${formatCurrency(data.last_payment_amount)} on ${formatDate(data.last_payment_date)}\n`;
      }
      responseText += `\n`;
    }
  }

  // Mortgages Section
  if (mortgageLiabilities.length > 0 && (!type || type === "mortgage")) {
    responseText += `## Mortgages (${mortgageLiabilities.length})\n\n`;

    for (const liability of mortgageLiabilities) {
      const data = liability.data as any;
      const propertyAddress = data.property_address
        ? `${data.property_address.street}, ${data.property_address.city}, ${data.property_address.region} ${data.property_address.postal_code}`
        : "N/A";

      responseText += `### ${liability.account_name || "Unknown Account"}\n`;
      responseText += `- **Property:** ${propertyAddress}\n`;
      responseText += `- **Loan Type:** ${data.loan_type_description || "N/A"}\n`;
      responseText += `- **Loan Term:** ${data.loan_term || "N/A"}\n`;
      responseText += `- **Interest Rate:** ${data.interest_rate_percentage ? `${data.interest_rate_percentage.toFixed(2)}%` : "N/A"} (${data.interest_rate_type || "N/A"})\n`;
      responseText += `- **Next Payment:** ${formatCurrency(data.next_monthly_payment)} due ${formatDate(data.next_payment_due_date)}\n`;
      responseText += `- **Origination:** ${formatCurrency(data.origination_principal_amount)} on ${formatDate(data.origination_date)}\n`;
      responseText += `- **Maturity Date:** ${formatDate(data.maturity_date)}\n`;
      if (data.escrow_balance) {
        responseText += `- **Escrow Balance:** ${formatCurrency(data.escrow_balance)}\n`;
      }
      if (data.has_pmi) {
        responseText += `- **PMI:** Yes\n`;
      }
      if (data.past_due_amount && data.past_due_amount > 0) {
        responseText += `- **Past Due:** ${formatCurrency(data.past_due_amount)} ⚠️\n`;
      }
      responseText += `\n`;
    }
  }

  // Student Loans Section
  if (studentLiabilities.length > 0 && (!type || type === "student")) {
    responseText += `## Student Loans (${studentLiabilities.length})\n\n`;

    for (const liability of studentLiabilities) {
      const data = liability.data as any;
      const loanStatus = data.loan_status?.type || "N/A";
      const repaymentPlan = data.repayment_plan?.type || "N/A";

      responseText += `### ${liability.account_name || "Unknown Account"}\n`;
      responseText += `- **Loan Name:** ${data.loan_name || "N/A"}\n`;
      responseText += `- **Guarantor:** ${data.guarantor || "N/A"}\n`;
      responseText += `- **Interest Rate:** ${data.interest_rate_percentage ? `${data.interest_rate_percentage.toFixed(2)}%` : "N/A"}\n`;
      responseText += `- **Status:** ${loanStatus}\n`;
      responseText += `- **Repayment Plan:** ${repaymentPlan}\n`;
      responseText += `- **Next Payment:** ${formatCurrency(data.minimum_payment_amount)} due ${formatDate(data.next_payment_due_date)}\n`;
      responseText += `- **Outstanding Interest:** ${formatCurrency(data.outstanding_interest_amount)}\n`;
      responseText += `- **Origination:** ${formatCurrency(data.origination_principal_amount)} on ${formatDate(data.origination_date)}\n`;
      responseText += `- **Expected Payoff:** ${formatDate(data.expected_payoff_date)}\n`;
      if (data.is_overdue) {
        responseText += `- **Overdue:** Yes ⚠️\n`;
      }
      responseText += `\n`;
    }
  }

  responseText += `*Last synced: ${new Date().toLocaleString()}*\n`;

  // Build structured content
  const structuredLiabilities = liabilities.map((l) => ({
    type: l.type,
    account_id: l.account_id,
    account_name: l.account_name,
    account_type: l.account_type,
    account_subtype: l.account_subtype,
    data: l.data,
  }));

  logToolEvent("get-liabilities", "complete", {
    userId,
    totalLiabilities: liabilities.length,
    creditCount: creditLiabilities.length,
    mortgageCount: mortgageLiabilities.length,
    studentCount: studentLiabilities.length,
  });

  return {
    content: [
      {
        type: "text",
        text: responseText.trim(),
      },
    ],
    structuredContent: {
      liabilities: structuredLiabilities,
      summary: {
        totalLiabilities: liabilities.length,
        creditCount: creditLiabilities.length,
        mortgageCount: mortgageLiabilities.length,
        studentCount: studentLiabilities.length,
      },
      dataInstructions: `
LIABILITIES DATA ANALYSIS GUIDELINES:
- Credit cards show APRs, payment schedules, and overdue status
- Mortgages include property details, loan terms, and interest rates
- Student loans show repayment plans, guarantors, and outstanding interest
- All amounts are in USD unless otherwise specified
- Dates are in ISO format (YYYY-MM-DD)
      `.trim(),
    },
  };
}
