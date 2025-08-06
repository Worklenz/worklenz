import session from "express-session";
import db from "../config/db";
import { isProduction } from "../shared/utils";
import * as cookieSignature from "cookie-signature";

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
  
  console.log("Session middleware debug:");
  console.log("- Cookie header:", req.headers.cookie);
  console.log("- X-Session-ID header:", headerSessionId);
  console.log("- X-Session-Name header:", headerSessionName);
  
  if (headerSessionId && headerSessionName) {
    console.log("Mobile app using header-based session:", headerSessionId);
    
    // The problem is cookie signature - we need to create a properly signed cookie
    const secret = process.env.SESSION_SECRET || "development-secret-key";
    
    try {
      // Create a signed cookie using the session secret
      const signedSessionId = 's:' + cookieSignature.sign(headerSessionId, secret);
      const encodedSignedId = encodeURIComponent(signedSessionId);
      const sessionCookie = `${headerSessionName}=${encodedSignedId}`;
      
      console.log("Creating signed session cookie:");
      console.log("- Raw session ID:", headerSessionId);
      console.log("- Signed session ID:", signedSessionId);
      console.log("- Encoded signed ID:", encodedSignedId);
      console.log("- Final cookie:", sessionCookie);
      
      if (req.headers.cookie) {
        // Replace existing session cookie while keeping other cookies
        req.headers.cookie = req.headers.cookie
          .split(';')
          .filter((cookie: string) => !cookie.trim().startsWith(headerSessionName))
          .concat(sessionCookie)
          .join(';');
      } else {
        // Set the session cookie from header
        req.headers.cookie = sessionCookie;
      }
      console.log("Updated cookie header:", req.headers.cookie);
    } catch (error) {
      console.log("Error creating signed cookie:", error);
      // Fallback to the old method
      const sessionCookie = `${headerSessionName}=s%3A${headerSessionId}`;
      req.headers.cookie = sessionCookie;
    }
  }
  
  sessionMiddleware(req, res, (err: any) => {
    if (err) {
      console.log("Session middleware error:", err);
    }
    
    // Debug what the session middleware produced
    console.log("After session middleware:");
    console.log("- Session ID:", (req as any).sessionID);
    console.log("- Session data exists:", !!(req as any).session);
    console.log("- Session passport data:", (req as any).session?.passport);
    console.log("- Is authenticated:", !!(req as any).isAuthenticated && (req as any).isAuthenticated());
    
    next(err);
  });
};