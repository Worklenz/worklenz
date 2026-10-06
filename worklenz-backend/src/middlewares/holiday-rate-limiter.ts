import rateLimit from "express-rate-limit";

/**
 * Holiday endpoints issue database queries and the import/populate operations
 * may create many records. Key by authenticated user so shared networks do not
 * cause legitimate users to throttle one another.
 */
export const holidayRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    done: false,
    body: null,
    message: "Too many holiday requests. Please slow down and try again shortly.",
  },
  keyGenerator: (req) => (req as { user?: { id?: string } }).user?.id || req.ip || "unknown",
});
