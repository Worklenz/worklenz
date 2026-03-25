#!/usr/bin/env node
/**
 * PPM Monday.com → ppm_ tables migration script
 *
 * Reads clients, active tasks, and time tracking data from Monday.com API
 * and outputs SQL INSERT statements for the ppm_ staging tables.
 *
 * Usage:
 *   MONDAY_API_KEY=your_key node ppm-monday-export.js > ppm-inserts.sql
 *
 * Requires: node 18+ (uses native fetch)
 */

const API_KEY = process.env.MONDAY_API_KEY;
if (!API_KEY) {
  console.error("Error: Set MONDAY_API_KEY environment variable");
  process.exit(1);
}

const MONDAY_API = "https://api.monday.com/v2";

// Board IDs from the audit report
const BOARDS = {
  CLIENT_MASTER: 18392998217,
  CREATIVE_PIPELINE: 18392999987,
  PAID_MEDIA: 18393001257,
  ONBOARDING: 18392999280,
  TTS_OPS: 18394071410,
  CREATIVE_ALL_CLIENTS: 18398088559,
  WEBSITE_OPS_ALL: 18398088561,
  WEBSITE_OPS_PIPELINE: 18398088564,
};

// Per-client board IDs — add actual IDs here once resolved from Monday API
// The audit didn't list individual per-client board IDs, but they can be
// discovered via the boards query below.
const PER_CLIENT_BOARDS = [];

async function mondayQuery(query, variables = {}) {
  const res = await fetch(MONDAY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Monday API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

// Escape single quotes for SQL string literals
function esc(val) {
  if (val === null || val === undefined) return "NULL";
  const s = String(val).replace(/'/g, "''");
  return `'${s}'`;
}

function escNum(val) {
  if (val === null || val === undefined || val === "") return "0";
  const n = parseFloat(val);
  return isNaN(n) ? "0" : String(n);
}

function escBool(val) {
  if (val === true || val === "true" || val === "Yes") return "TRUE";
  return "FALSE";
}

function escDate(val) {
  if (!val || val === "" || val === "null") return "NULL";
  // Monday dates come as JSON objects or ISO strings
  const dateStr = typeof val === "object" && val.date ? val.date : String(val);
  if (dateStr === "" || dateStr === "null") return "NULL";
  // Validate date format to prevent SQL injection (YYYY-MM-DD with optional time)
  if (!/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/.test(dateStr)) return "NULL";
  return `'${dateStr}'`;
}

// Extract column value by column ID from Monday item
function colVal(item, colId) {
  const col = item.column_values.find((c) => c.id === colId);
  if (!col) return null;
  // Try parsing JSON value
  try {
    const parsed = JSON.parse(col.value);
    if (parsed === null) return col.text || null;
    if (typeof parsed === "object") {
      // People columns
      if (parsed.personsAndTeams) {
        return col.text;
      }
      // Date columns
      if (parsed.date) return parsed.date;
      // Status columns
      if (parsed.label) return parsed.label;
      // Link columns
      if (parsed.url) return parsed.url;
      // Email columns
      if (parsed.email) return parsed.email;
      // Phone columns
      if (parsed.phone) return parsed.phone;
      // Number columns
      if (parsed.value !== undefined) return parsed.value;
    }
    return col.text || String(parsed);
  } catch {
    return col.text || null;
  }
}

// ---------------------------------------------------------------------------
// Fetch all items from a board with pagination
// ---------------------------------------------------------------------------
async function fetchBoardItems(boardId) {
  const items = [];
  let cursor = null;

  // First page
  const firstPage = await mondayQuery(`
    query ($boardId: [ID!]!) {
      boards(ids: $boardId) {
        name
        items_page(limit: 100) {
          cursor
          items {
            id
            name
            group { title }
            column_values {
              id
              text
              value
            }
          }
        }
      }
    }
  `, { boardId: [String(boardId)] });

  const board = firstPage.boards[0];
  if (!board) return { name: "Unknown", items: [] };

  items.push(...board.items_page.items);
  cursor = board.items_page.cursor;

  // Subsequent pages
  while (cursor) {
    const page = await mondayQuery(`
      query ($cursor: String!) {
        next_items_page(cursor: $cursor, limit: 100) {
          cursor
          items {
            id
            name
            group { title }
            column_values {
              id
              text
              value
            }
          }
        }
      }
    `, { cursor });

    items.push(...page.next_items_page.items);
    cursor = page.next_items_page.cursor;
  }

  return { name: board.name, items };
}

// ---------------------------------------------------------------------------
// Discover per-client boards (Category C from audit)
// ---------------------------------------------------------------------------
async function discoverBoards() {
  const data = await mondayQuery(`
    query {
      boards(limit: 50) {
        id
        name
        board_kind
      }
    }
  `);
  return data.boards;
}

// ---------------------------------------------------------------------------
// Generate SQL for ppm_clients
// ---------------------------------------------------------------------------
async function exportClients() {
  console.log("-- =============================================================");
  console.log("-- ppm_clients: Client Master Board (ID: 18392998217)");
  console.log("-- =============================================================");

  const { items } = await fetchBoardItems(BOARDS.CLIENT_MASTER);

  for (const item of items) {
    // Map Monday column IDs to values
    // Column IDs are auto-generated by Monday — these are the standard names.
    // The script uses text fallback so exact IDs don't need to match perfectly.
    const vals = {
      monday_item_id: item.id,
      name: item.name,
      client_status: colVal(item, "status") || colVal(item, "client_status"),
      ops_status: colVal(item, "status_1") || colVal(item, "ops_status"),
      overall_health: colVal(item, "status_2") || colVal(item, "overall_health"),
      primary_partner: colVal(item, "people") || colVal(item, "primary_partner"),
      paid_media_owner: colVal(item, "people_1") || colVal(item, "paid_media_owner"),
      creative_owner: colVal(item, "people_2") || colVal(item, "creative_owner"),
      retention_owner: colVal(item, "people_3") || colVal(item, "retention_owner"),
      next_milestone: colVal(item, "text") || colVal(item, "next_milestone"),
      milestone_date: colVal(item, "date"),
      contracted_scope: colVal(item, "text_1") || colVal(item, "contracted_scope"),
      contracted_hours: colVal(item, "numbers") || colVal(item, "contracted_hours__monthly_"),
      estimated_hours: colVal(item, "mirror") || colVal(item, "estimated_hours"),
      actual_hours: colVal(item, "mirror_1") || colVal(item, "actual_hours"),
      website: colVal(item, "link") || colVal(item, "website"),
      contact_name: colVal(item, "text_2") || colVal(item, "client_contact_name"),
      contact_email: colVal(item, "email") || colVal(item, "contact_email"),
      contact_phone: colVal(item, "phone") || colVal(item, "contact__"),
      monday_group: item.group ? item.group.title : null,
    };

    // Compute hours_remaining and pct_used from available data
    const est = parseFloat(vals.estimated_hours) || 0;
    const act = parseFloat(vals.actual_hours) || 0;
    const contracted = parseFloat(vals.contracted_hours) || 0;
    const remaining = contracted > 0 ? contracted - act : est - act;
    const pctUsed = contracted > 0 && contracted !== 0 ? (act / contracted) * 100 : 0;

    console.log(`INSERT INTO ppm_clients (
  monday_item_id, name, client_status, ops_status, overall_health,
  primary_partner, paid_media_owner, creative_owner, retention_owner,
  next_milestone, milestone_date, contracted_scope, contracted_hours,
  estimated_hours, actual_hours, hours_remaining, pct_used,
  website, contact_name, contact_email, contact_phone, monday_group
) VALUES (
  ${vals.monday_item_id}, ${esc(vals.name)}, ${esc(vals.client_status)}, ${esc(vals.ops_status)}, ${esc(vals.overall_health)},
  ${esc(vals.primary_partner)}, ${esc(vals.paid_media_owner)}, ${esc(vals.creative_owner)}, ${esc(vals.retention_owner)},
  ${esc(vals.next_milestone)}, ${escDate(vals.milestone_date)}, ${esc(vals.contracted_scope)}, ${escNum(vals.contracted_hours)},
  ${escNum(vals.estimated_hours)}, ${escNum(vals.actual_hours)}, ${escNum(remaining)}, ${escNum(pctUsed)},
  ${esc(vals.website)}, ${esc(vals.contact_name)}, ${esc(vals.contact_email)}, ${esc(vals.contact_phone)}, ${esc(vals.monday_group)}
) ON CONFLICT (monday_item_id) DO UPDATE SET
  name = EXCLUDED.name,
  client_status = EXCLUDED.client_status,
  ops_status = EXCLUDED.ops_status,
  overall_health = EXCLUDED.overall_health,
  contracted_hours = EXCLUDED.contracted_hours,
  estimated_hours = EXCLUDED.estimated_hours,
  actual_hours = EXCLUDED.actual_hours,
  hours_remaining = EXCLUDED.hours_remaining,
  pct_used = EXCLUDED.pct_used,
  updated_at = CURRENT_TIMESTAMP;
`);
  }
}

// ---------------------------------------------------------------------------
// Generate SQL for ppm_tasks from a board
// ---------------------------------------------------------------------------
function emitTaskInserts(boardId, boardName, items) {
  for (const item of items) {
    const vals = {
      monday_item_id: item.id,
      monday_board_id: boardId,
      monday_board_name: boardName,
      name: item.name,
      client_name: colVal(item, "client") || colVal(item, "dropdown") || colVal(item, "board_relation"),
      owner: colVal(item, "people") || colVal(item, "owner"),
      assigned_to: colVal(item, "people_1") || colVal(item, "assigned_to"),
      priority: colVal(item, "status") || colVal(item, "priority"),
      task_type: colVal(item, "status_1") || colVal(item, "type"),
      channel: colVal(item, "status_2") || colVal(item, "channel"),
      design_status: colVal(item, "mirror") || colVal(item, "design_status"),
      request_status: colVal(item, "status_3") || colVal(item, "creative_request_status") || colVal(item, "request_status"),
      approval_date: colVal(item, "date") || colVal(item, "approval_submission_date"),
      due_date: colVal(item, "date_1") || colVal(item, "due_date__with_revisions_") || colVal(item, "due_date"),
      send_date: colVal(item, "date_2") || colVal(item, "send_date"),
      creative_brief: colVal(item, "long_text") || colVal(item, "creative_brief"),
      promotion_details: colVal(item, "text") || colVal(item, "promotion_details"),
      products_promoted: colVal(item, "text_1") || colVal(item, "products_promoted"),
      copy_text: colVal(item, "long_text_1") || colVal(item, "copy"),
      call_to_actions: colVal(item, "text_2") || colVal(item, "call_to_actions"),
      estimated_hours: colVal(item, "numbers") || colVal(item, "estimated_hours"),
      actual_hours: colVal(item, "numbers_1") || colVal(item, "actual_hours"),
      partner_overflow: colVal(item, "checkbox") || colVal(item, "partner_overflow"),
      month_completed: colVal(item, "status_4") || colVal(item, "month_completed"),
      monday_group: item.group ? item.group.title : null,
    };

    console.log(`INSERT INTO ppm_tasks (
  monday_item_id, monday_board_id, monday_board_name, name,
  client_name, owner, assigned_to, priority, task_type, channel,
  design_status, request_status, approval_date, due_date, send_date,
  creative_brief, promotion_details, products_promoted, copy_text, call_to_actions,
  estimated_hours, actual_hours, partner_overflow, month_completed, monday_group
) VALUES (
  ${vals.monday_item_id}, ${vals.monday_board_id}, ${esc(vals.monday_board_name)}, ${esc(vals.name)},
  ${esc(vals.client_name)}, ${esc(vals.owner)}, ${esc(vals.assigned_to)}, ${esc(vals.priority)}, ${esc(vals.task_type)}, ${esc(vals.channel)},
  ${esc(vals.design_status)}, ${esc(vals.request_status)}, ${escDate(vals.approval_date)}, ${escDate(vals.due_date)}, ${escDate(vals.send_date)},
  ${esc(vals.creative_brief)}, ${esc(vals.promotion_details)}, ${esc(vals.products_promoted)}, ${esc(vals.copy_text)}, ${esc(vals.call_to_actions)},
  ${escNum(vals.estimated_hours)}, ${escNum(vals.actual_hours)}, ${escBool(vals.partner_overflow)}, ${esc(vals.month_completed)}, ${esc(vals.monday_group)}
) ON CONFLICT (monday_item_id) DO UPDATE SET
  name = EXCLUDED.name,
  client_name = EXCLUDED.client_name,
  design_status = EXCLUDED.design_status,
  request_status = EXCLUDED.request_status,
  estimated_hours = EXCLUDED.estimated_hours,
  actual_hours = EXCLUDED.actual_hours,
  monday_group = EXCLUDED.monday_group,
  updated_at = CURRENT_TIMESTAMP;
`);
  }
}

// ---------------------------------------------------------------------------
// Generate SQL for ppm_time_entries (derived from tasks with hour data)
// ---------------------------------------------------------------------------
function emitTimeEntries(boardId, boardName, items) {
  for (const item of items) {
    const estHours = colVal(item, "numbers") || colVal(item, "estimated_hours") || "0";
    const actHours = colVal(item, "numbers_1") || colVal(item, "actual_hours") || "0";
    const estNum = parseFloat(estHours) || 0;
    const actNum = parseFloat(actHours) || 0;

    // Only emit time entries for items that have hour data
    if (estNum === 0 && actNum === 0) continue;

    const clientName = colVal(item, "client") || colVal(item, "dropdown") || colVal(item, "board_relation");
    const monthCompleted = colVal(item, "status_4") || colVal(item, "month_completed");

    console.log(`INSERT INTO ppm_time_entries (
  monday_item_id, monday_board_id, task_name, client_name,
  estimated_hours, actual_hours, month_completed, source_board
) VALUES (
  ${item.id}, ${boardId}, ${esc(item.name)}, ${esc(clientName)},
  ${escNum(estNum)}, ${escNum(actNum)}, ${esc(monthCompleted)}, ${esc(boardName)}
);
`);
  }
}

// ---------------------------------------------------------------------------
// Export active tasks from all relevant boards
// ---------------------------------------------------------------------------
async function exportTasks() {
  // Boards that contain active tasks
  const taskBoards = [
    BOARDS.CREATIVE_PIPELINE,
    BOARDS.PAID_MEDIA,
    BOARDS.ONBOARDING,
    BOARDS.TTS_OPS,
    BOARDS.CREATIVE_ALL_CLIENTS,
    BOARDS.WEBSITE_OPS_ALL,
    BOARDS.WEBSITE_OPS_PIPELINE,
  ];

  // Discover per-client boards
  const allBoards = await discoverBoards();
  const knownIds = new Set(Object.values(BOARDS).map(String));
  const perClientBoards = allBoards.filter((b) => {
    // Include boards that look like per-client boards (Creative Requests, Website/Ops)
    const isPerClient =
      (b.name.includes("Creative Requests") || b.name.includes("Website/Ops")) &&
      !knownIds.has(b.id) &&
      b.board_kind !== "private";
    return isPerClient;
  });

  for (const b of perClientBoards) {
    taskBoards.push(parseInt(b.id));
  }

  for (const boardId of taskBoards) {
    const { name: boardName, items } = await fetchBoardItems(boardId);
    if (items.length === 0) continue;

    console.log(`-- =============================================================`);
    console.log(`-- ppm_tasks: ${boardName} (ID: ${boardId}) — ${items.length} items`);
    console.log(`-- =============================================================`);
    emitTaskInserts(boardId, boardName, items);

    console.log(`-- ppm_time_entries from: ${boardName}`);
    emitTimeEntries(boardId, boardName, items);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("-- PPM Monday.com → ppm_ tables migration");
  console.log(`-- Generated: ${new Date().toISOString()}`);
  console.log("-- Source: Monday.com API");
  console.log("--");
  console.log("-- Run the staging table DDL first:");
  console.log("--   \\i 20260325000000-ppm-monday-staging-tables.sql");
  console.log("--");
  console.log("BEGIN;");
  console.log("");

  await exportClients();
  console.log("");
  await exportTasks();

  console.log("");
  console.log("COMMIT;");
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
