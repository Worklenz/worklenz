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
  },
  // Custom session ID handling for mobile apps
  genid: () => {
    return require('uid-safe').sync(24);
  }
};

console.log("Session configuration:", {
  ...sessionConfig,
  secret: "[REDACTED]"
});

const sessionMiddleware = session(sessionConfig);

// Enhanced session middleware that supports both cookies and headers for mobile apps
export default (req: any, res: any, next: any) => {
  // Check if mobile app is sending session ID via header (fallback for cookie issues)
  const headerSessionId = req.headers['x-session-id'];
  const headerSessionName = req.headers['x-session-name'];
  
  if (headerSessionId && headerSessionName && !req.headers.cookie) {
    console.log("Mobile app using header-based session:", headerSessionId);
    // Inject the session cookie from header for session middleware to process
    req.headers.cookie = `${headerSessionName}=s%3A${headerSessionId}`;
  }
  
  sessionMiddleware(req, res, next);
};