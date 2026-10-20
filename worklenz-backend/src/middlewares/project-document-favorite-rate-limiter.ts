import rateLimit from "express-rate-limit";

/**
 * Rate limiter for PUT /project-documents/:id/favorite.
 *
 * Each call is a small per-user write; 120 per minute is far above any manual
 * starring. Keyed by user id (falling back to IP) so shared NATs don't collide.
 */
export const documentFavoriteRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    done: false,
    body: null,
    message: "Too many favorite updates. Please slow down and try again shortly.",
  },
  keyGenerator: (req) => (req as any).user?.id || req.ip || "unknown",
});
