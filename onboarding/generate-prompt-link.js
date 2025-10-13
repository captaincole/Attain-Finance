#!/usr/bin/env node

/**
 * Generate ChatGPT ?prompt= URL from initial prompt text
 *
 * Usage:
 *   node generate-prompt-link.js
 *
 * Reads: chatgpt-initial-prompt.txt
 * Outputs: Full ChatGPT URL with encoded prompt
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the prompt text
const promptFile = path.join(__dirname, 'chatgpt-initial-prompt.txt');
const promptText = fs.readFileSync(promptFile, 'utf-8').trim();

// Build the full ChatGPT URL
const baseUrl = 'https://chatgpt.com/';
const params = new URLSearchParams({
  prompt: promptText  // URLSearchParams handles encoding
});

const fullUrl = `${baseUrl}?${params.toString()}`;

// Output results
console.log('='.repeat(80));
console.log('ChatGPT Onboarding Prompt Link Generator');
console.log('='.repeat(80));
console.log();
console.log('📝 Original Prompt:');
console.log('-'.repeat(80));
console.log(promptText);
console.log();
console.log('🔗 Full ChatGPT URL:');
console.log('-'.repeat(80));
console.log(fullUrl);
console.log();
console.log('📋 For Beta Tester Guide:');
console.log('-'.repeat(80));
console.log(`[Open ChatGPT with Welcome Message](${fullUrl})`);
console.log();
console.log('✨ URL Length:', fullUrl.length, 'characters');
console.log();

// Optional: Write to a file
const outputFile = path.join(__dirname, 'chatgpt-link.txt');
fs.writeFileSync(outputFile, fullUrl, 'utf-8');
console.log(`💾 Saved to: ${outputFile}`);
console.log();
