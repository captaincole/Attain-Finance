import { z } from "zod";
import type { ToolDefinition } from "../types.js";

interface MortgageOption {
  lender: string;
  productName: string;
  apr: number;
  monthlyPayment: number;
  closingCosts: number;
  termYears: number;
  rateType: "fixed" | "arm";
  link: string;
  notes?: string;
}

const mortgageOptions: MortgageOption[] = [
  {
    lender: "Chase",
    productName: "Premier 30-Year Fixed",
    apr: 5.35,
    monthlyPayment: 3985,
    closingCosts: 8200,
    termYears: 30,
    rateType: "fixed",
    link: "https://home.chase.com/start-application",
    notes: "Includes 0.25% rate discount with autopay",
  },
  {
    lender: "Morgan Stanley",
    productName: "Private Wealth 10/6 ARM",
    apr: 5.05,
    monthlyPayment: 3725,
    closingCosts: 9400,
    termYears: 30,
    rateType: "arm",
    link: "https://www.morganstanley.com/mortgages/apply",
    notes: "Rates locked for 10 years, then adjusts every 6 months",
  },
  {
    lender: "Attain Finance",
    productName: "Attain Smart Mortgage 20-Year",
    apr: 5.15,
    monthlyPayment: 4275,
    closingCosts: 6100,
    termYears: 20,
    rateType: "fixed",
    link: "https://attain.finance/products/mortgage",
    notes: "Pre-qualify instantly in chat, includes budgeting integration",
  },
];

const mortgageArgsSchema = z.object({
  loanAmount: z.number().positive().optional(),
  downPayment: z.number().min(0).optional(),
});

export function getMortgageOptionsTool(): ToolDefinition {
  return {
    name: "get-mortgage-options",
    description:
      "Surface three sample mortgage offers from partner lenders, including APR, monthly payment estimates, and application links.",
    inputSchema: mortgageArgsSchema.shape,
    options: {
      readOnlyHint: true,
      securitySchemes: [{ type: "oauth2" }],
    },
    handler: async (args, { authInfo }) => {
      const userId = authInfo?.extra?.userId as string | undefined;
      if (!userId) {
        throw new Error("User authentication required");
      }

      const parsedArgs = mortgageArgsSchema.parse(args ?? {});
      const contextLines: string[] = [];
      if (typeof parsedArgs.loanAmount === "number") {
        contextLines.push(`Target loan amount: $${parsedArgs.loanAmount.toLocaleString()}`);
      }
      if (typeof parsedArgs.downPayment === "number") {
        contextLines.push(`Down payment: $${parsedArgs.downPayment.toLocaleString()}`);
      }

      let responseText = "🏠 **Suggested Mortgage Options**\n\n";
      if (contextLines.length > 0) {
        responseText += contextLines.join("\n") + "\n\n";
      }

      mortgageOptions.forEach((option) => {
        responseText += `**${option.lender} — ${option.productName}**\n`;
        responseText += `• APR: ${option.apr.toFixed(2)}%\n`;
        responseText += `• Estimated monthly payment: $${option.monthlyPayment.toLocaleString()}\n`;
        responseText += `• Closing costs: $${option.closingCosts.toLocaleString()}\n`;
        responseText += `• Term: ${option.termYears} years (${option.rateType.toUpperCase()})\n`;
        if (option.notes) {
          responseText += `• Notes: ${option.notes}\n`;
        }
        responseText += `• Apply: ${option.link}\n\n`;
      });

      responseText +=
        "Next steps: compare the payments to your cash flow, then follow one of the application links if the option fits.";

      return {
        content: [
          {
            type: "text" as const,
            text: responseText.trim(),
          },
        ],
        structuredContent: {
          mortgageOptions,
          context: {
            loanAmount: parsedArgs.loanAmount ?? null,
            downPayment: parsedArgs.downPayment ?? null,
          },
          followUpPrompt:
            "Use these options to evaluate affordability, discuss trade-offs (APR, monthly payment, term), and guide the user to start an application when they are ready.",
        },
      };
    },
  };
}
