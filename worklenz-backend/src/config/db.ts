import pgModule, { PoolClient, QueryResult } from "pg";
import dbConfig from "./db-config";

const pg =
  process.env.USE_PG_NATIVE === "true" && pgModule.native
    ? pgModule.native
    : pgModule;

// Configure pg to return DATE types as strings to prevent timezone conversion issues
// PostgreSQL DATE type (OID 1082) should be returned as 'YYYY-MM-DD' string
// This prevents the pg library from converting dates to JavaScript Date objects at midnight UTC,
// which causes dates to shift by one day for users in negative GMT offsets (e.g., GMT-3)
const types = pg.types;
types.setTypeParser(1082, (val: string) => val); // 1082 is the OID for DATE type

const pool = new pg.Pool(dbConfig);

pool.on("error", (err: Error) => {
  // eslint-disable-next-line no-console
  console.error("pg idle client error", err, err.message, err.stack);
});

export default {
  pool,
  query: (text: string, params?: unknown[]) =>
    pool.query(text, params) as Promise<QueryResult<any>>,
  connect: (): Promise<PoolClient> => pool.connect(),
};
