import session from "express-session";
import db from "../config/db";
import { isProduction } from "../shared/utils";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pgSession = require("connect-pg-simple")(session);

// For cross-origin requests, we need special cookie settings
const isHttps = process.env.NODE_ENV === "production" || process.env.FORCE_HTTPS === "true";

export default session({
  name: process.env.SESSION_NAME || "worklenz.sid",
  secret: process.env.SESSION_SECRET || "development-secret-key",
  proxy: true, // Enable proxy support for proper session handling
  resave: false,
  saveUninitialized: false, // Changed to false to prevent unnecessary session creation
  rolling: true,
  store: new pgSession({
    pool: db.pool,
    tableName: "pg_sessions"
  }),
  cookie: {
    path: "/",
    secure: isHttps, // Only secure in production with HTTPS
    httpOnly: true, // Enable httpOnly for security
    sameSite: isHttps ? "none" : false, // Use "none" for HTTPS cross-origin, disable for HTTP
    domain: undefined, // Don't set domain for cross-origin requests
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
});