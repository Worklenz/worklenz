// Publish the active add-on IDs as a PostgreSQL session setting. Optional
// add-on triggers can check it without requiring add-on tables in core.
const enabledAddons = (process.env.ENABLED_ADDONS || "")
  .split(",")
  .map(id => id.trim())
  .filter(id => /^[a-z0-9][a-z0-9-]*$/.test(id))
  .join(",");

export default {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: +(process.env.DB_PORT as string),
  max: +(process.env.DB_MAX_CLIENTS as string),
  connectionTimeoutMillis: +(process.env.DB_CONNECTION_TIMEOUT_MS || "10000"),
  idleTimeoutMillis: 30000,
  options: `${process.env.PGOPTIONS ? `${process.env.PGOPTIONS} ` : ""}-c worklenz.enabled_addons=${enabledAddons}`,
};
