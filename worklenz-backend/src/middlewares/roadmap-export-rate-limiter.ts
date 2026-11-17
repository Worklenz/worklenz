import rateLimit from "express-rate-limit";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";

// Large exports are sent in sequential 500-row parts. This still permits
// substantial exports while limiting sustained repeated rendering per user.
export const roadmapExportRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => (req as IWorkLenzRequest).user?.id || req.ip || "unknown",
  message: { done: false, body: null, message: "Too many roadmap exports. Please try again shortly." },
});
