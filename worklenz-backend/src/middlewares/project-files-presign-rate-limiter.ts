import rateLimit from "express-rate-limit";

/**
 * Rate limiter for POST /projects/:projectId/files/presign
 *
 * Every presign call inserts a `pending` row in project_files even if the
 * browser never uploads. Without a cap, an authenticated user could hammer the
 * endpoint to flood the table (a low-effort denial-of-storage). 60 presigns per
 * minute per user is well above any legitimate multi-file upload burst.
 *
 * Keyed by user id (falling back to IP) so users behind a shared NAT don't
 * starve each other.
 */
export const presignRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    done: false,
    body: null,
    message: "Too many upload requests. Please slow down and try again shortly.",
  },
  keyGenerator: (req) => (req as any).user?.id || req.ip || "unknown",
});
