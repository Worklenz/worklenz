import pgModule, {QueryResult} from "pg";
import dbConfig from "./db-config";

const pg = (process.env.USE_PG_NATIVE === "true" && pgModule.native) ? pgModule.native : pgModule;
const pool = new pg.Pool(dbConfig);

pool.on("error", (err: Error) => {
  // eslint-disable-next-line no-console
  console.error("pg idle client error", err, err.message, err.stack);
});

export default {
  pool,
  query: (text: string, params?: unknown[]) => pool.query(text, params) as Promise<QueryResult<any>>,
};
