import rateLimit from "express-rate-limit";

/**
 * Rate limiter for POST /auth/reset-password
 * Prevents email flooding, SES quota exhaustion, and timing-based email enumeration.
 * 5 requests per 15 minutes per IP.
 */
export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    done: false,
    body: null,
    message: "Too many password reset requests. Please try again in 15 minutes.",
  },
  keyGenerator: (req) => req.ip || "unknown",
});

/**
 * Rate limiter for POST /auth/update-password
 * Prevents brute-force token guessing.
 * 10 attempts per 15 minutes per IP.
 */
export const updatePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    done: false,
    body: null,
    message: "Too many password update attempts. Please try again in 15 minutes.",
  },
  keyGenerator: (req) => req.ip || "unknown",
});
