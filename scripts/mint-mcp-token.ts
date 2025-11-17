#!/usr/bin/env tsx
import { fileURLToPath } from "url";
import path from "path";
import process from "process";
import readline from "readline";
import dotenv from "dotenv";
import { createClerkClient } from "@clerk/backend";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error("❌ CLERK_SECRET_KEY is not set. Please populate it in your .env file.");
    process.exit(1);
  }

  const templateName = process.env.MCP_BEARER_TEMPLATE_NAME;
  if (!templateName) {
    console.error("❌ MCP_BEARER_TEMPLATE_NAME is not set. Define it in your .env to mint tokens.");
    process.exit(1);
  }

  const userIdArg = process.argv.find((arg) => arg.startsWith("--userId="));
  const userIdFromArg = userIdArg ? userIdArg.split("=")[1] : undefined;
  const userId = userIdFromArg || (await prompt("Enter Clerk user ID: "));

  if (!userId) {
    console.error("❌ A Clerk user ID is required to mint a token.");
    process.exit(1);
  }

  try {
    const clerkClient = createClerkClient({ secretKey });
    // Create a short-lived session for the target user so we can mint a JWT
    const session = await clerkClient.sessions.createSession({ userId });
    // Generate a JWT from the configured template for that session
    const token = await clerkClient.sessions.getToken(session.id, templateName);

    console.log("\n✅ JWT minted successfully:\n");
    console.log(token.jwt);
  } catch (error: any) {
    console.error("\n❌ Failed to mint JWT:");
    if (error?.errors) {
      console.error(JSON.stringify(error.errors, null, 2));
    } else {
      console.error(error?.message || error);
    }
    process.exit(1);
  }
}

main();
