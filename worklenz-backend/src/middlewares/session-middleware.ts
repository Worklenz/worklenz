import session from "express-session";
import db from "../config/db";
import { isProduction } from "../shared/utils";
import * as cookieSignature from "cookie-signature";
import { randomBytes } from "crypto";

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
    // For mobile app support in production, use "none", for local development use "lax"
    sameSite: "lax" as const,
    // Secure only in production (HTTPS required for sameSite: "none")
    secure: false,
    domain: undefined,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  },
  // Custom session ID handling for mobile apps
  genid: () => {
    return randomBytes(24).toString("base64url");
  }
};

const sessionMiddleware = session(sessionConfig);

// Enhanced session middleware that supports both cookies and headers for mobile apps
export default (req: any, res: any, next: any) => {
  // Check if mobile app is sending session ID via header (fallback for cookie issues)
  const headerSessionId = req.headers["x-session-id"];
  const headerSessionName = req.headers["x-session-name"];
  
  // Only process headers if they exist AND there's no existing valid session cookie
  if (headerSessionId && headerSessionName) {
    const secret = process.env.SESSION_SECRET || "development-secret-key";
    
    try {
      // Create a signed cookie using the session secret
      const signedSessionId = `s:${cookieSignature.sign(headerSessionId, secret)}`;
      const encodedSignedId = encodeURIComponent(signedSessionId);
      const sessionCookie = `${headerSessionName}=${encodedSignedId}`;
      
      if (req.headers.cookie) {
        // Replace existing session cookie while keeping other cookies
        req.headers.cookie = req.headers.cookie
          .split(";")
          .filter((cookie: string) => !cookie.trim().startsWith(headerSessionName))
          .concat(sessionCookie)
          .join(";");
      } else {
        // Set the session cookie from header
        req.headers.cookie = sessionCookie;
      }
    } catch (error) {
      // Fallback to the old method
      const sessionCookie = `${headerSessionName}=s%3A${headerSessionId}`;
      req.headers.cookie = sessionCookie;
    }
  }
  
  // Always call the original session middleware (handles both cookie and header-converted cases)
  sessionMiddleware(req, res, next);
};