import rateLimit from "express-rate-limit";

/**
 * Per-IP limits for the client sign-in routes. The service adds its own per-address limits (a resend
 * cooldown, codes per hour, wrong guesses per code), so these only stop one machine from spraying many
 * addresses or guessing across many codes.
 */

/** POST /auth/otp/request: 10 requests per 15 minutes per IP. */
export const clientSignInRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    done: false,
    body: { code: "TOO_MANY_REQUESTS" },
    message: "Too many sign-in requests. Please try again in 15 minutes.",
  },
  keyGenerator: req => req.ip || "unknown",
});

/** POST /auth/otp/verify: 20 attempts per 15 minutes per IP. */
export const clientSignInVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    done: false,
    body: { code: "TOO_MANY_REQUESTS" },
    message: "Too many attempts. Please try again in 15 minutes.",
  },
  keyGenerator: req => req.ip || "unknown",
});

/** POST /auth/refresh and /handle-organization-invite: 30 requests per 15 minutes per IP. */
export const clientTokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    done: false,
    body: { code: "TOO_MANY_REQUESTS" },
    message: "Too many requests. Please try again in 15 minutes.",
  },
  keyGenerator: req => req.ip || "unknown",
});
