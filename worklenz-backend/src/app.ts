import createError from "http-errors";
import express, { NextFunction, Request, Response } from "express";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import helmet from "helmet";
import compression from "compression";
import passport from "passport";
import { csrfSync } from "csrf-sync";
import rateLimit from "express-rate-limit";
import cors from "cors";
import flash from "connect-flash";
import hpp from "hpp";

import passportConfig from "./passport";
import apiRouter from "./routes/apis";
import authRouter from "./routes/auth";
import emailTemplatesRouter from "./routes/email-templates";
import public_router from "./routes/public";
import clientPortalApiRouter from "./routes/apis/client-portal-api-router";
import { isInternalServer, isProduction } from "./shared/utils";
import sessionMiddleware from "./middlewares/session-middleware";
import safeControllerFunction from "./shared/safe-controller-function";
import AwsSesController from "./controllers/aws-ses-controller";
import { CSP_POLICIES } from "./shared/csp";
import { sqlInjectionDetectorWithBlocking } from "./middlewares/sql-injection-detector";
import { createCsrfRotation } from "./middlewares/csrf-rotation";

const app = express();

// Trust first proxy if behind reverse proxy
app.set("trust proxy", 1);

// Basic middleware setup
app.use(compression());
app.use(logger("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(hpp());

// Helmet security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
}));

app.use((_req: Request, res: Response, next: NextFunction) => {
  // Remove server header to hide server information
  res.removeHeader("server");
  
  // Content Security Policy (already configured via CSP_POLICIES)
  res.setHeader("Content-Security-Policy", CSP_POLICIES);
  
  // Strict Transport Security (HSTS) - only in production with HTTPS
  if (isProduction()) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  
  // Prevent clickjacking attacks
  res.setHeader("X-Frame-Options", "DENY");
  
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // XSS Protection (legacy but still useful for older browsers)
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Control referrer information
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Restrict browser features and APIs
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  
  next();
});

// CORS configuration
const allowedOrigins = [
  isProduction()
    ? [
        `http://localhost:5000`,
        `http://127.0.0.1:5000`,
        `https://app.worklenz.com`,
        `https://www.app.worklenz.com`,
        `https://clients.worklenz.com`,
        `https://react.worklenz.com`,
        `https://www.react.worklenz.com`,
        `https://wl-client.ceydigital.dev`,
        `https://appleid.apple.com`,  // Allow Apple Sign-In OAuth requests
        process.env.SERVER_CORS || "",  // Add hostname from env
        process.env.FRONTEND_URL || ""  // Support FRONTEND_URL as well
      ].filter(Boolean)  // Remove empty strings
    : [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5000",
      `http://localhost:5000`,
      `https://appleid.apple.com`,  // Allow Apple Sign-In OAuth requests
      process.env.SERVER_CORS || "",  // Add hostname from env
      process.env.FRONTEND_URL || ""  // Support FRONTEND_URL as well
    ].filter(Boolean)  // Remove empty strings
].flat();

app.use(cors({
  origin: (origin, callback) => {
    // In development, allow all requests
    if (!isProduction()) {
      return callback(null, true);
    }
    
    // In production, allow requests without Origin header (for mobile apps, native clients)
    // Mobile apps and native clients typically don't send Origin headers
    if (!origin) {
      return callback(null, true);
    }
    
    // If Origin header is present in production, validate it against whitelist
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("Blocked origin:", origin, process.env.NODE_ENV);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "X-CSRF-Token",
    "x-client-token"
  ],
  exposedHeaders: ["Set-Cookie", "X-CSRF-Token"]
}));

// Handle preflight requests
app.options("*", cors());

// The middleware can be re-enabled for monitoring if needed, but blocking is no longer necessary
// if (isProduction()) {
//   app.use(sqlInjectionDetectorWithBlocking);
// }

// Session setup - must be before passport and CSRF
app.use(sessionMiddleware);

// Passport initialization
passportConfig(passport);
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// Auth check middleware
function isLoggedIn(req: Request, _res: Response, next: NextFunction) {
  // Allow client portal invitation routes to bypass authentication
  const fullPath = req.originalUrl || req.url;

  if (req.path.includes("/client-portal/invitation/") ||
    req.path.includes("/client-portal/auth/login") ||
    req.path.includes("/client-portal/auth/refresh") ||
    req.path.includes("/client-portal/handle-organization-invite") ||
    req.path.startsWith("/invite/team/") ||
    req.path.startsWith("/invite/project/") ||
    fullPath.includes("/client-portal/invitation/") ||
    fullPath.includes("/client-portal/auth/login") ||
    fullPath.includes("/client-portal/auth/refresh") ||
    fullPath.includes("/client-portal/handle-organization-invite") ||
    fullPath.startsWith("/invite/team/") ||
    fullPath.startsWith("/invite/project/")) {
    return next();
  }
  return req.user ? next() : next(createError(401));
}

// Enhanced with stronger token generation
const {
  invalidCsrfTokenError,
  generateToken,
  csrfSynchronisedProtection,
} = csrfSync({
  getTokenFromRequest: (req: Request) => {
    // Express normalizes headers to lowercase, so check both cases
    const token = req.headers["x-csrf-token"] as string || 
                  req.headers["X-CSRF-Token"] as string ||
                  (req.body && req.body["_csrf"]);
    
    return token;
  },
  // Note: csrf-sync uses crypto.randomBytes internally, which is secure
  // Token size is determined by the library (typically 32 bytes)
});

// Only exclude: webhooks, public routes, and specific invitation endpoints
app.use((req, res, next) => {
  const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  const isStateChanging = stateChangingMethods.includes(req.method);
  
  // Always exclude webhooks (external services can't provide CSRF tokens)
  if (req.path.startsWith("/webhook/")) {
    return next();
  }
  
  // Exclude public routes (read-only or public access)
  if (req.path.startsWith("/public/")) {
    return next();
  }
  
  // Exclude specific invitation endpoints (these have their own token validation)
  if (
    req.path.startsWith("/invite/team/") ||
    req.path.startsWith("/invite/project/") ||
    req.path.includes("/client-portal/invitation/") ||
    req.path.includes("/client-portal/handle-organization-invite")
  ) {
    return next();
  }
  
  // Exclude all client portal endpoints (they use client token authentication)
  if (req.path.startsWith("/client-portal") || req.originalUrl.startsWith("/api/client-portal")) {
    return next();
  }
  
  // Exclude the CSRF token endpoint itself (GET requests to fetch tokens)
  if (req.path === "/csrf-token") {
    return next();
  }
  
  // Exclude mobile app authentication endpoints (mobile apps can't send CSRF tokens)
  // Check both with and without /secure prefix since req.path might vary depending on mounting
  const authPaths = [
    "/login", "/secure/login",
    "/signup", "/secure/signup",
    "/signup/check", "/secure/signup/check",
    "/verify", "/secure/verify",
    "/reset-password", "/secure/reset-password",
    "/update-password", "/secure/update-password",
    "/verify-captcha", "/secure/verify-captcha",
    "/google/mobile", "/secure/google/mobile",
    "/apple/mobile", "/secure/apple/mobile",
    "/google", "/secure/google",
    "/google/verify", "/secure/google/verify",
    "/apple", "/secure/apple",
    "/apple/verify", "/secure/apple/verify"
  ];
  
  if (authPaths.includes(req.path)) {
    return next();
  }
  
  // This protects POST, PUT, DELETE, PATCH operations from CSRF attacks
  // GET, OPTIONS, HEAD requests don't need CSRF protection
  if (isStateChanging) {
    csrfSynchronisedProtection(req, res, next);
  } else {
    next();
  }
});

// Set CSRF token method on request object for compatibility
app.use((req: Request, res: Response, next: NextFunction) => {
  // Add csrfToken method to request object for compatibility
  if (!req.csrfToken && generateToken) {
    req.csrfToken = (overwrite?: boolean) => generateToken(req, overwrite);
  }
  next();
});

// CSRF token refresh endpoint
// Note: This endpoint doesn't require authentication, but needs a session
app.get("/csrf-token", (req: Request, res: Response) => {
  try {
    // Check if session exists (csrf-sync requires session)
    if (!req.session) {
      return res.status(401).json({ done: false, message: "Session required for CSRF token" });
    }
    
    const token = generateToken(req);
    if (!token) {
      console.error('[CSRF] Failed to generate token');
      return res.status(500).json({ done: false, message: "Failed to generate CSRF token" });
    }
    
    // Also send token in header for convenience
    res.setHeader('X-CSRF-Token', token);
    res.status(200).json({ done: true, message: "CSRF token refreshed", token });
  } catch (error: any) {
    console.error('[CSRF] Error generating token:', error);
    res.status(500).json({ done: false, message: "Failed to generate CSRF token", error: error?.message });
  }
});

// Webhook endpoints (no CSRF required)
app.post("/webhook/emails/bounce", safeControllerFunction(AwsSesController.handleBounceResponse));
app.post("/webhook/emails/complaints", safeControllerFunction(AwsSesController.handleComplaintResponse));
app.post("/webhook/emails/delivery", safeControllerFunction(AwsSesController.handleDeliveryEvents));
app.post("/webhook/emails/reply", safeControllerFunction(AwsSesController.handleReplies));

// Static file serving
if (isProduction()) {
  app.use(express.static(path.join(__dirname, "build"), {
    maxAge: "1y",
    etag: false,
  }));

  // Handle compressed files
  app.get("*.js", (req, res, next) => {
    if (req.header("Accept-Encoding")?.includes("br")) {
      req.url = `${req.url}.br`;
      res.set("Content-Encoding", "br");
      res.set("Content-Type", "application/javascript; charset=UTF-8");
    } else if (req.header("Accept-Encoding")?.includes("gzip")) {
      req.url = `${req.url}.gz`;
      res.set("Content-Encoding", "gzip");
      res.set("Content-Type", "application/javascript; charset=UTF-8");
    }
    next();
  });
} else {
  app.use(express.static(path.join(__dirname, "public")));
}

// API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction() ? 1500 : 3000, // 100 req/min in production, 200 req/min in dev
  standardHeaders: false,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again later.",
});

// Export endpoint rate limiting
const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // 50 exports per 15 minutes
  standardHeaders: false,
  legacyHeaders: false,
  message: "Too many export requests, please try again later.",
});

// Create CSRF rotation middleware
const csrfRotation = createCsrfRotation(generateToken);

// Routes
// Add CSRF token rotation to state-changing routes
// TEMPORARY: Disable CSRF rotation to prevent token conflicts with concurrent requests
// Token rotation causes issues when multiple requests are in flight
app.use("/api/v1", apiLimiter, isLoggedIn, apiRouter);
app.use("/api/client-portal", apiLimiter, clientPortalApiRouter);
app.use("/secure", authRouter);
app.use("/public", public_router);

if (isInternalServer()) {
  app.use("/email-templates", emailTemplatesRouter);
}

// CSRF error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err === invalidCsrfTokenError) {
    return res.status(403).json({
      done: false,
      message: "Invalid CSRF token",
      body: null
    });
  }
  next(err);
});

// React app handling - serve index.html for all non-API routes
app.get("*", (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, isProduction() ? "build" : "public", "index.html"));
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || 500;

  if (res.headersSent) {
    return;
  }

  res.status(status);

  // Send structured error response
  res.json({
    done: false,
    message: isProduction() ? "Internal Server Error" : err.message,
    body: null,
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {})
  });
});

export default app;