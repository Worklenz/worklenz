// eslint-disable-next-line @typescript-eslint/no-var-requires
const {Client} = require("pg");

import dotenv from "dotenv";
import {generateProjectKey} from "../utils/generate-project-key";

dotenv.config();

const client = new Client({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  max: process.env.DB_MAX_CLIENTS,
  idleTimeoutMillis: 30000,
});

function log(message: string) {
  console.log("Projects Keys Migration:", message);
}

async function getAllKeysByTeamId(teamId: string) {
  if (!teamId) return [];
  try {
    const result = await client.query("SELECT key FROM projects WHERE team_id = $1 ORDER BY key;", [teamId]);
    return result.rows.map((project: any) => project.key).filter((key: any) => !!key);
  } catch (error) {
    return [];
  }
}

async function runProjectsKeyMigration() {
  log("migration started");
  const result = await client.query("SELECT id, name, team_id FROM projects WHERE key IS NULL ORDER BY created_at;", []);
  log(`${result.rows.length} projects found`);
  for (const project of result.rows) {
    const keys = await getAllKeysByTeamId(project.team_id);
    const key = generateProjectKey(project.name, keys);
    await client.query("UPDATE projects SET key = $1 WHERE id = $2", [key, project.id]);
    log(`${project.name} (${key})`);
  }
  log("migration ended");
}

client.connect(async (error: any) => {
  if (!error) {
    await runProjectsKeyMigration();
    client.end();
  } else {
    console.error(error);
  }
});
