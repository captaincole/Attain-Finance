#!/usr/bin/env tsx
/**
 * Generate properly encrypted access tokens for seed data
 * Run with: npx tsx scripts/encrypt-seed-tokens.ts
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  console.error("Error: ENCRYPTION_KEY environment variable not set");
  process.exit(1);
}

function encryptAccessToken(accessToken: string): string {
  const keyBuffer = Buffer.from(ENCRYPTION_KEY!, "hex");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv);

  let encrypted = cipher.update(accessToken, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

// Plaid sandbox access tokens (these are fake placeholder values)
const tokens = {
  credit_access_token: "access-sandbox-credit-card-token",
  invest_access_token: "access-sandbox-investment-token",
  car_access_token: "access-sandbox-auto-loan-token",
  checking_access_token: "access-sandbox-checking-token",
};

console.log("Encrypted access tokens for seed.sql:\n");

for (const [name, token] of Object.entries(tokens)) {
  const encrypted = encryptAccessToken(token);
  console.log(
    `  ${name} CONSTANT text := COALESCE(NULLIF(current_setting('${name}', true), ''), '${encrypted}');`
  );
}

console.log(
  "\n✅ Copy the above lines and replace lines 17-20 in supabase/seed.sql"
);
