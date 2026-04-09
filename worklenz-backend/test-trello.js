import TrelloProvider from "../src/services/import-providers/trello-provider";

// Test Trello location import
async function testTrelloLocation() {
  const provider = new TrelloProvider();
  
  // Mock job with Trello credentials from .env file
  const job = {
    id: "test-job",
    provider: "trello",
    source_reference: {
      auth: {
        trello: {
          key: "56abf15790bd59f6d0623083676840e0",
          token: "ATTAf735c3afbff047ebba3e2036fe21be64ffaacd389d7541956587da4b4738679c917B7704"
        }
      },
      source: {
        trello: {
          boardId: "YOUR_BOARD_ID_HERE", // Replace with your board ID
          boardName: "Your Board Name"
        }
      }
    }
  } as any;

  try {
    console.log("Testing Trello ingest...");
    const result = await provider.ingest(job);
    console.log("Ingest result:", {
      tasksCount: result.tasks?.length || 0,
      fieldsCount: result.fields?.length || 0,
      raw: result.raw
    });

    // Log some tasks to see location data
    if (result.tasks && result.tasks.length > 0) {
      result.tasks.slice(0, 3).forEach((task, index) => {
        console.log(`Task ${index + 1} (${task.title}):`, {
          raw: task.raw
        });
      });
    }

    // Log field mappings
    console.log("Field mappings:", result.fields);

  } catch (error) {
    console.error("Error testing Trello:", error);
  }
}

testTrelloLocation();