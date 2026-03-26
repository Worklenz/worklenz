#!/usr/bin/env node

/**
 * Trello Location Field Diagnostic Script
 * This script directly calls the Trello API to diagnose location field issues
 */

const https = require("https");
const url = require("url");

// Configuration - You'll need to update these values from your .env or import job
const TRELLO_CONFIG = {
  key:
    process.env.TRELLO_API_KEY ||
    process.env.TRELLO_KEY ||
    "56abf15790bd59f6d0623083676840e0",
  token:
    process.env.TRELLO_TOKEN ||
    process.env.TRELLO_ACCESS_TOKEN ||
    "ATTAf735c3afbff047ebba3e2036fe21be64ffaacd389d7541956587da4b4738679c917B7704",
  boardId: "6971f6dcf6c15b8aa4bf62a2", // Your board ID from the logs
};

// Utility function to make HTTP requests
function makeRequest(requestUrl) {
  return new Promise((resolve, reject) => {
    const options = url.parse(requestUrl);
    options.headers = {
      "User-Agent": "Worklenz-Trello-Diagnostic/1.0",
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(
            new Error(
              `Failed to parse JSON: ${error.message}\nRaw data: ${data}`,
            ),
          );
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}

// Build URL with query parameters
function buildUrl(baseUrl, params) {
  const urlObj = new URL(baseUrl);
  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null) {
      urlObj.searchParams.append(key, params[key]);
    }
  });
  return urlObj.toString();
}

async function diagnoseTrelloLocationFields() {
  console.log("🔍 Trello Location Field Diagnostic Tool");
  console.log("=====================================\n");

  if (!TRELLO_CONFIG.key || !TRELLO_CONFIG.token) {
    console.error("❌ Missing Trello API credentials!");
    console.error(
      "Please set TRELLO_API_KEY and TRELLO_TOKEN environment variables",
    );
    console.error("Or update the TRELLO_CONFIG object in this script");
    return;
  }

  try {
    console.log(`📋 Board ID: ${TRELLO_CONFIG.boardId}\n`);

    // 1. Fetch board info
    console.log("1️⃣  Fetching board information...");
    const boardUrl = buildUrl(
      `https://api.trello.com/1/boards/${TRELLO_CONFIG.boardId}`,
      {
        key: TRELLO_CONFIG.key,
        token: TRELLO_CONFIG.token,
        fields: "name,desc,closed",
      },
    );

    const board = await makeRequest(boardUrl);
    console.log(`   ✅ Board: "${board.name}"`);
    console.log(`   📝 Description: ${board.desc || "No description"}`);
    console.log(`   🔒 Closed: ${board.closed}\n`);

    // 2. Fetch custom fields
    console.log("2️⃣  Fetching custom fields...");
    const customFieldsUrl = buildUrl(
      `https://api.trello.com/1/boards/${TRELLO_CONFIG.boardId}/customFields`,
      {
        key: TRELLO_CONFIG.key,
        token: TRELLO_CONFIG.token,
      },
    );

    const customFields = await makeRequest(customFieldsUrl);
    console.log(`   📊 Found ${customFields.length} custom fields:`);

    const locationFields = [];
    customFields.forEach((field, index) => {
      const isLocationField =
        field.type === "location" ||
        (field.name && field.name.toLowerCase().includes("location")) ||
        field.name === "Location";

      console.log(
        `   ${index + 1}. "${field.name}" (${field.type}) - ID: ${field.id}`,
      );

      if (isLocationField) {
        console.log(`      🎯 LOCATION FIELD DETECTED!`);
        locationFields.push(field);
      }
    });

    if (locationFields.length === 0) {
      console.log(`   ⚠️  No location fields detected!`);
    } else {
      console.log(`   ✅ Found ${locationFields.length} location field(s)!\n`);
    }

    // 3. Fetch a sample of cards with custom field items
    console.log("3️⃣  Fetching cards with custom field data...");
    const cardsUrl = buildUrl(
      `https://api.trello.com/1/boards/${TRELLO_CONFIG.boardId}/cards`,
      {
        key: TRELLO_CONFIG.key,
        token: TRELLO_CONFIG.token,
        customFieldItems: true,
        limit: 20, // Fetch more cards for diagnosis
        fields: "name,desc,customFieldItems",
      },
    );

    const cards = await makeRequest(cardsUrl);
    console.log(`   📇 Fetched ${cards.length} cards for analysis:\n`);

    // 4. Analyze each card's custom field items
    cards.forEach((card, cardIndex) => {
      console.log(`   Card ${cardIndex + 1}: "${card.name}"`);

      if (!card.customFieldItems || card.customFieldItems.length === 0) {
        console.log(`     ❌ No custom field items found`);
        console.log("");
        return;
      }

      console.log(
        `     📋 Custom field items (${card.customFieldItems.length}):`,
      );

      card.customFieldItems.forEach((item, itemIndex) => {
        const field = customFields.find((f) => f.id === item.idCustomField);
        const fieldName = field ? field.name : "Unknown Field";
        const fieldType = field ? field.type : "Unknown Type";

        const isLocationItem = locationFields.some(
          (lf) => lf.id === item.idCustomField,
        );

        console.log(
          `       ${itemIndex + 1}. Field: "${fieldName}" (${fieldType})`,
        );
        console.log(`          ID: ${item.idCustomField}`);
        console.log(`          Value: ${JSON.stringify(item.value, null, 10)}`);

        if (isLocationItem) {
          console.log(`          🎯 THIS IS LOCATION DATA!`);

          // Detailed analysis of location value structure
          if (item.value) {
            const value = item.value;
            console.log(`          📍 Location value analysis:`);
            if (typeof value === "string") {
              console.log(`             - Direct string: "${value}"`);
            } else if (typeof value === "object") {
              console.log(`             - Object properties:`);
              Object.keys(value).forEach((key) => {
                console.log(
                  `               * ${key}: ${JSON.stringify(value[key])}`,
                );
              });
            }
          } else {
            console.log(`          ❌ Location value is null/empty!`);
          }
        }
        console.log("");
      });
    });

    // 5. Summary
    console.log("📊 DIAGNOSTIC SUMMARY");
    console.log("====================");
    console.log(`✅ Board access: Working`);
    console.log(`📊 Custom fields: ${customFields.length} total`);
    console.log(`🎯 Location fields: ${locationFields.length} detected`);
    console.log(`📇 Cards analyzed: ${cards.length}`);

    const cardsWithCustomFields = cards.filter(
      (c) => c.customFieldItems && c.customFieldItems.length > 0,
    );
    console.log(`📋 Cards with custom data: ${cardsWithCustomFields.length}`);

    const locationFieldIds = locationFields.map((f) => f.id);
    let cardsWithLocationData = 0;
    cards.forEach((card) => {
      if (card.customFieldItems) {
        const hasLocationData = card.customFieldItems.some(
          (item) => locationFieldIds.includes(item.idCustomField) && item.value,
        );
        if (hasLocationData) cardsWithLocationData++;
      }
    });

    console.log(`🗺️  Cards with location data: ${cardsWithLocationData}`);

    if (locationFields.length > 0 && cardsWithLocationData === 0) {
      console.log(
        `\n⚠️  ISSUE IDENTIFIED: Location fields exist but no cards have location data!`,
      );
      console.log(
        `   This explains why the Location column shows empty values.`,
      );
    } else if (locationFields.length === 0) {
      console.log(
        `\n⚠️  ISSUE IDENTIFIED: No location fields found on this board!`,
      );
      console.log(
        `   Check if the location field exists in your Trello board.`,
      );
    } else {
      console.log(`\n✅ Location data found! Check the detailed output above.`);
    }
  } catch (error) {
    console.error("❌ Error during diagnosis:", error.message);
    console.error("Stack trace:", error.stack);
  }
}

// Check if running directly (not imported)
if (require.main === module) {
  diagnoseTrelloLocationFields();
}

module.exports = { diagnoseTrelloLocationFields };
