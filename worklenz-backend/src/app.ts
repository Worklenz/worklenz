import createError from "http-errors";
import express, { NextFunction, Request, Response } from "express";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import helmet from "helmet";
import compression from "compression";
import passport from "passport";
import { csrfSync } from "csrf-sync";
import cors from "cors";
import flash from "connect-flash";
import hpp from "hpp";

import passportConfig from "./passport";
import apiRouter from "./routes/apis";
import importsApiRouter from "./routes/apis/imports-api-router";
import authRouter from "./routes/auth";
import emailTemplatesRouter from "./routes/email-templates";
import public_router from "./routes/public";
import { isInternalServer, isProduction, log_error } from "./shared/utils";
import sessionMiddleware from "./middlewares/session-middleware";
import safeControllerFunction from "./shared/safe-controller-function";
import AwsSesController from "./controllers/aws-ses-controller";
import business from "./business";
import { CSP_POLICIES } from "./shared/csp";
import importWorker from "./services/import-worker";
import { sqlInjectionDetectorWithBlocking } from "./middlewares/sql-injection-detector";
import { createCsrfRotation } from "./middlewares/csrf-rotation";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";

const app = express();

if (process.env.IMPORT_WORKER_ENABLED !== "false") {
  importWorker.start();
}

// Trust first proxy if behind reverse proxy
app.set("trust proxy", 1);

// Basic middleware setup
app.use(compression());
app.use(logger("dev"));
app.use(express.json({
  limit: "50mb",
  verify: (req: Request & { rawBody?: string }, _res, buf) => {
    const url = req.originalUrl || req.url || "";
    if (url.includes("/webhook/directpay/")) {
      req.rawBody = buf.toString("utf8");
    }
  },
}));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(hpp());

// Helmet security headers
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  }),
);

app.use((_req: Request, res: Response, next: NextFunction) => {
  // Remove server header to hide server information
  res.removeHeader("server");

  // Content Security Policy (already configured via CSP_POLICIES)
  res.setHeader("Content-Security-Policy", CSP_POLICIES);

  // Strict Transport Security (HSTS) - only in production with HTTPS
  if (isProduction()) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
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
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()",
  );

  next();
});

const parseCsvOrigins = (value?: string): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

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
        `https://appleid.apple.com`, // Allow Apple Sign-In OAuth requests
        `https://api.ncinga.worklenz.com`,
        `https://ncinga.worklenz.com`,
        `https://www.ncinga.worklenz.com`,
      ]
    : [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5173",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:5000",
      `http://localhost:5000`,
      `https://appleid.apple.com`, // Allow Apple Sign-In OAuth requests
    ]
].flat();

allowedOrigins.push(
  ...parseCsvOrigins(process.env.SERVER_CORS),
  ...parseCsvOrigins(process.env.FRONTEND_URL)
);

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
    "x-client-token",
    "Cache-Control",
    "cache-control",
    "Pragma",
    "pragma",
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

  if (
    req.path.includes("/client-portal/invitation/") ||
    req.path.includes("/client-portal/auth/login") ||
    req.path.includes("/client-portal/auth/refresh") ||
    req.path.includes("/client-portal/handle-organization-invite") ||
    req.path.startsWith("/invite/team/") ||
    req.path.startsWith("/invite/project/") ||
    req.path.includes("/imports/auth/asana/callback") ||
    fullPath.includes("/client-portal/invitation/") ||
    fullPath.includes("/client-portal/auth/login") ||
    fullPath.includes("/client-portal/auth/refresh") ||
    fullPath.includes("/client-portal/handle-organization-invite") ||
    fullPath.startsWith("/invite/team/") ||
    fullPath.startsWith("/invite/project/") ||
    fullPath.includes("/imports/auth/asana/callback")
  ) {
    return next();
  }
  return req.user ? next() : next(createError(401));
}

// Enhanced with stronger token generation
const { invalidCsrfTokenError, generateToken, csrfSynchronisedProtection } =
  csrfSync({
    getTokenFromRequest: (req: Request) => {
      // Express normalizes headers to lowercase, so check both cases
      const token =
        (req.headers["x-csrf-token"] as string) ||
        (req.headers["X-CSRF-Token"] as string) ||
        (req.body && req.body["_csrf"]);

      return token;
    },
    // Note: csrf-sync uses crypto.randomBytes internally, which is secure
    // Token size is determined by the library (typically 32 bytes)
  });

// Only exclude: webhooks, public routes, and specific invitation endpoints
app.use((req, res, next) => {
  const stateChangingMethods = ["POST", "PUT", "DELETE", "PATCH"];
  const isStateChanging = stateChangingMethods.includes(req.method);

  // Get all possible path variations early
  const path = req.path || "";
  const originalUrl = req.originalUrl || req.url || "";
  const baseUrl = req.baseUrl || "";

  // Always exclude webhooks (external services can't provide CSRF tokens)
  if (path.startsWith("/webhook/") || originalUrl.startsWith("/webhook/") ||
      originalUrl.includes("/webhook/directpay/")) {
    log_error(`[CSRF] Excluding webhook: ${path}`);
    return next();
  }

  // Exclude public routes (read-only or public access)
  if (path.startsWith("/public/") || originalUrl.startsWith("/public/")) {
    log_error(`[CSRF] Excluding public route: ${path}`);
    return next();
  }

  // Exclude specific invitation endpoints (these have their own token validation)
  if (
    path.startsWith("/invite/team/") ||
    path.startsWith("/invite/project/") ||
    path.includes("/client-portal/invitation/") ||
    path.includes("/client-portal/handle-organization-invite") ||
    originalUrl.includes("/client-portal/invitation/") ||
    originalUrl.includes("/client-portal/handle-organization-invite")
  ) {
    log_error(`[CSRF] Excluding invitation route: ${path}`);
    return next();
  }

  // Exclude all client portal endpoints (they use client token authentication)
  // SECURITY NOTE: Client portal uses token-based auth (x-client-token header) instead of cookies.
  // Custom headers are NOT automatically sent by browsers in cross-origin requests, making this
  // inherently CSRF-resistant. CSRF attacks rely on browsers automatically including credentials
  // (cookies), which doesn't apply to custom headers that require explicit JavaScript to send.
  // Additional protections: token verification, origin validation, and rate limiting are still applied.
  // Check multiple path variations to ensure we catch all cases
  const isClientPortalRoute =
    path.startsWith("/client-portal") ||
    path.startsWith("/api/client-portal") ||
    originalUrl.startsWith("/api/client-portal") ||
    originalUrl.startsWith("/client-portal") ||
    originalUrl.includes("/client-portal/") ||
    baseUrl.includes("/client-portal");

  if (isClientPortalRoute) {
    return next();
  }

  // Exclude the CSRF token endpoint itself (GET requests to fetch tokens)
  // Use strict matching to only exempt the actual token endpoint, not routes containing the substring
  if (
    req.path === "/csrf-token" ||
    originalUrl === "/csrf-token" ||
    originalUrl.startsWith("/csrf-token/") ||
    path === "/csrf-token" ||
    path.startsWith("/csrf-token/")
  ) {
    return next();
  }

  // Exclude mobile app authentication endpoints (mobile apps can't send CSRF tokens)
  // Check both with and without /secure prefix since req.path might vary depending on mounting
  const authPaths = [
    "/login",
    "/secure/login",
    "/signup",
    "/secure/signup",
    "/signup/check",
    "/secure/signup/check",
    "/verify",
    "/secure/verify",
    "/reset-password",
    "/secure/reset-password",
    "/update-password",
    "/secure/update-password",
    "/verify-captcha",
    "/secure/verify-captcha",
    "/google/mobile",
    "/secure/google/mobile",
    "/apple/mobile",
    "/secure/apple/mobile",
    "/google",
    "/secure/google",
    "/google/verify",
    "/secure/google/verify",
    "/apple",
    "/secure/apple",
    "/apple/verify",
    "/secure/apple/verify",
  ];

  if (authPaths.includes(req.path)) {
    return next();
  }

  // This protects POST, PUT, DELETE, PATCH operations from CSRF attacks
  // GET, OPTIONS, HEAD requests don't need CSRF protection
  if (isStateChanging) {
    csrfSynchronisedProtection(req, res, (err) => {
      if (err) {
        console.error(`[CSRF] CSRF protection error:`, err);
        console.error(`[CSRF] Request details:`, {
          method: req.method,
          path: req.path,
          originalUrl: req.originalUrl,
          url: req.url,
        });
      }
      next(err);
    });
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
      return res
        .status(401)
        .json({ done: false, message: "Session required for CSRF token" });
    }

    const token = generateToken(req);
    if (!token) {
      log_error("[CSRF] Failed to generate token");
      return res
        .status(500)
        .json({ done: false, message: "Failed to generate CSRF token" });
    }

    // Also send token in header for convenience
    res.setHeader("X-CSRF-Token", token);
    res
      .status(200)
      .json({ done: true, message: "CSRF token refreshed", token });
  } catch (error: any) {
    log_error("[CSRF] Error generating token:", error);
    res
      .status(500)
      .json({
        done: false,
        message: "Failed to generate CSRF token",
        error: error?.message,
      });
  }
});

// Webhook endpoints (no CSRF required)
app.post(
  "/webhook/emails/bounce",
  safeControllerFunction(AwsSesController.handleBounceResponse),
);
app.post(
  "/webhook/emails/complaints",
  safeControllerFunction(AwsSesController.handleComplaintResponse),
);
app.post(
  "/webhook/emails/delivery",
  safeControllerFunction(AwsSesController.handleDeliveryEvents),
);
app.post(
  "/webhook/emails/reply",
  safeControllerFunction(AwsSesController.handleReplies),
);

// Payment webhooks — Business-plan only (DirectPay/Paddle); CE no-op
business.registerWebhooks(app);

// Static file serving
if (isProduction()) {
  app.use(
    express.static(path.join(__dirname, "build"), {
      maxAge: "1y",
      etag: false,
    }),
  );

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

// Swagger UI documentation (development only)
if (!isProduction()) {
  try {
    const swaggerDocument = YAML.load(
      path.join(__dirname, "docs/openapi.yaml"),
    );

    app.use(
      "/api-docs",
      swaggerUi.serve,
      swaggerUi.setup(swaggerDocument, {
        customCss: ".swagger-ui .topbar { display: none }",
        customSiteTitle: "Worklenz API Documentation",
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          filter: true,
          tryItOutEnabled: true,
        },
      }),
    );

    const swaggerPort = process.env.PORT || "3000";
    console.log(
      `📚 Swagger UI available at http://localhost:${swaggerPort}/api-docs`,
    );
  } catch (error) {
    console.error("Failed to load OpenAPI documentation:", error);
  }
}

// Rate limiting is handled by nginx - see nginx configuration for rate limit zones:
// - api_general: 200 req/s + burst 50
// - api_auth: 10 req/s + burst 10
// - api_export: 20 req/s + burst 30
// - api_socket: 50 req/s + burst 30

// Create CSRF rotation middleware
const csrfRotation = createCsrfRotation(generateToken);

// Routes
// Add CSRF token rotation to state-changing routes
// TEMPORARY: Disable CSRF rotation to prevent token conflicts with concurrent requests
// Backward compatibility for clients still calling /api/imports (without v1 prefix)
app.use("/api/v1", isLoggedIn, apiRouter);
app.use("/api/imports", isLoggedIn, importsApiRouter);
business.registerClientPortalRoutes(app); // EE: /api/client-portal; CE: no-op
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
      body: null,
    });
  }
  next(err);
});

// React app handling - serve index.html for all non-API routes
app.get("*", (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(
    path.join(__dirname, isProduction() ? "build" : "public", "index.html"),
  );
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
    message: (isProduction() && status >= 500) ? "Internal Server Error" : err.message,
    body: null,
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
});

export default app;
