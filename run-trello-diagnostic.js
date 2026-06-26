#!/usr/bin/env node

/**
 * Quick Trello Diagnostic Runner
 * Run this with: node run-trello-diagnostic.js
 */

const path = require("path");
require("dotenv").config({
  path: path.join(__dirname, "worklenz-backend", ".env"),
});

const {
  diagnoseTrelloLocationFields,
} = require("./trello-location-diagnostic");

console.log("🚀 Starting Trello Location Field Diagnostic...\n");

// Check for Trello credentials
const hasKey = process.env.TRELLO_API_KEY || process.env.TRELLO_KEY;
const hasToken = process.env.TRELLO_TOKEN || process.env.TRELLO_ACCESS_TOKEN;

if (!hasKey || !hasToken) {
  console.log("📝 SETUP REQUIRED: Trello API Credentials");
  console.log("=====================================\n");

  console.log("To run this diagnostic, you need Trello API credentials.");
  console.log("Based on your recent import, you should have these already.\n");

  console.log("Option 1: Set environment variables:");
  console.log('   export TRELLO_API_KEY="your_api_key"');
  console.log('   export TRELLO_TOKEN="your_token"\n');

  console.log("Option 2: Add to your .env file in worklenz-backend/:");
  console.log("   TRELLO_API_KEY=your_api_key");
  console.log("   TRELLO_TOKEN=your_token\n");

  console.log(
    "Option 3: Edit the TRELLO_CONFIG object in trello-location-diagnostic.js\n",
  );

  console.log("💡 To get credentials:");
  console.log("   1. Go to https://trello.com/app-key");
  console.log("   2. Get your API Key");
  console.log('   3. Click "Token" to get your access token\n');

  process.exit(1);
}

// Run the diagnostic
diagnoseTrelloLocationFields().catch((error) => {
  console.error("❌ Diagnostic failed:", error.message);
  process.exit(1);
});
