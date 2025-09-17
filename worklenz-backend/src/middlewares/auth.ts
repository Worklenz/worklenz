import { Request, Response, NextFunction } from "express";

// Passport session-based authentication guard
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
	const r = req as Request & { isAuthenticated?: () => boolean; user?: unknown };
	const isAuthenticated = typeof r.isAuthenticated === "function" && !!r.isAuthenticated();

	if (isAuthenticated && r.user) {
		return next();
	}

	// As a fallback, allow if user is already populated (e.g., custom auth)
	if (r.user) {
		return next();
	}

	return res.status(401).json({ error: "Authentication required" });
}
