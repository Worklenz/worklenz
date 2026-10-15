import { Pool } from "pg";
import db from "./db";
import dbConfig from "./db-config";
import { log_error } from "../shared/utils";

let retentionPool: Pool | undefined;

/** Use a dedicated login granted worklenz_audit_retention when the app uses a restricted DB role. */
export const getAuditRetentionPool = () => {
  const user = process.env.AUDIT_RETENTION_DB_USER;
  if (!user) return db.pool; // Function owners can already execute the purge; ordinary app roles cannot.
  if (!retentionPool) {
    retentionPool = new Pool({
      ...dbConfig,
      user,
      password: process.env.AUDIT_RETENTION_DB_PASSWORD,
      max: 1,
    });
    retentionPool.on("error", log_error);
  }
  return retentionPool;
};
