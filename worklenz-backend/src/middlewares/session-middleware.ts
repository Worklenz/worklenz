import session from "express-session";
import db from "../config/db";
import { isProduction } from "../shared/utils";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pgSession = require("connect-pg-simple")(session);

const sessionConfig = {
  name: process.env.SESSION_NAME,
  secret: process.env.SESSION_SECRET || "development-secret-key",
  proxy: false,
  resave: false,
  saveUninitialized: true,
  rolling: true,
  store: new pgSession({
    pool: db.pool,
    tableName: "pg_sessions"
  }),
  cookie: {
    path: "/",
    httpOnly: true,
    // For mobile app support, we might need these settings:
    sameSite: isProduction() ? "none" as const : "lax" as const,
    secure: isProduction(), // Required when sameSite is "none"
    domain: isProduction() ? ".worklenz.com" : undefined,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
};

console.log("Session configuration:", {
  ...sessionConfig,
  secret: "[REDACTED]"
});

export default session(sessionConfig);