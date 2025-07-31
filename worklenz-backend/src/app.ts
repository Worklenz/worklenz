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

// Custom security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.removeHeader("server");
  res.setHeader("Content-Security-Policy", CSP_POLICIES);
  next();
});

// CORS configuration
const allowedOrigins = [
  isProduction() 
    ? [
        `http://localhost:5000`,
        `http://127.0.0.1:5000`,
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
        process.env.SERVER_CORS || "",  // Add hostname from env
        process.env.FRONTEND_URL || ""  // Support FRONTEND_URL as well
      ].filter(Boolean)  // Remove empty strings
].flat();

app.use(cors({
  origin: (origin, callback) => {
    if (!isProduction() || !origin || allowedOrigins.includes(origin)) {
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
      fullPath.includes("/client-portal/invitation/") ||
      fullPath.includes("/client-portal/auth/login") ||
      fullPath.includes("/client-portal/auth/refresh") ||
      fullPath.includes("/client-portal/handle-organization-invite")) {
    return next();
  }
  return req.user ? next() : next(createError(401));
}

// CSRF configuration using csrf-sync for session-based authentication
const {
  invalidCsrfTokenError,
  generateToken,
  csrfSynchronisedProtection,
} = csrfSync({
  getTokenFromRequest: (req: Request) => req.headers["x-csrf-token"] as string || (req.body && req.body["_csrf"])
});

// Apply CSRF selectively (exclude webhooks, public routes, and client portal invitation routes)
app.use((req, res, next) => {
  if (
    req.path.startsWith("/webhook/") ||
    req.path.startsWith("/secure/") ||
    req.path.startsWith("/api/") ||
    req.path.startsWith("/public/") ||
    req.path.includes("/client-portal/invitation/") ||
    req.path.includes("/client-portal/auth/login") ||
    req.path.includes("/client-portal/auth/refresh") ||
    req.path.includes("/client-portal/handle-organization-invite")
  ) {
    next();
  } else {
    csrfSynchronisedProtection(req, res, next);
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
app.get("/csrf-token", (req: Request, res: Response) => {
  try {
    const token = generateToken(req);
    res.status(200).json({ done: true, message: "CSRF token refreshed", token });
  } catch (error) {
    res.status(500).json({ done: false, message: "Failed to generate CSRF token" });
  }
});

// Webhook endpoints (no CSRF required)
app.post("/webhook/emails/bounce", safeControllerFunction(AwsSesController.handleBounceResponse));
app.post("/webhook/emails/complaints", safeControllerFunction(AwsSesController.handleComplaintResponse));
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
  max: 1500,
  standardHeaders: false,
  legacyHeaders: false,
});

// Routes
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