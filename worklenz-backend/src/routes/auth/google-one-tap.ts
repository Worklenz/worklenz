import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { getGoogleOneTapConfig } from "../../config/google-one-tap";
import { GoogleOneTapRejected, issueGoogleChallenge, resolveGoogleAccount, verifyGoogleCredential } from "../../services/google-one-tap.service";
import { logAuditEvent, resolveOrganizationIdForUserId } from "../../services/audit-log.service";
import { AUDIT_EVENT_TYPE } from "../../shared/audit-log-constants";

const router = Router();
const limiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

router.get("/config", (_req, res) => {
  const config = getGoogleOneTapConfig();
  res.setHeader("Cache-Control", "no-store");
  return res.json({ done: true, body: config ? { enabled: true, clientId: config.clientId } : { enabled: false } });
});

// An Origin is mandatory for the browser flow; never accept the mobile session-header fallback here.
function authorizeBrowser(req: Request, res: Response, next: NextFunction) {
  const config = getGoogleOneTapConfig();
  const origin = req.get("origin");
  res.setHeader("Cache-Control", "no-store");
  if (!config) return res.status(503).json({ done: false, body: null });
  if (!origin || !config.allowedOrigins.includes(origin) || req.get("x-session-id") || req.get("x-session-name")) {
    return res.status(403).json({ done: false, body: null });
  }
  if (req.isAuthenticated()) return res.status(409).json({ done: false, body: null });
  return next();
}

router.post("/challenge", limiter, authorizeBrowser, (req, res) => {
  void issueGoogleChallenge(req.sessionID).then(nonce => {
    req.session.save(error => {
      if (error) return res.status(500).json({ done: false, body: null });
      return res.json({ done: true, body: { nonce } });
    });
  }).catch(() => res.status(500).json({ done: false, body: null }));
});

router.post("/login", limiter, authorizeBrowser, (req, res) => {
  const config = getGoogleOneTapConfig();
  const credential: unknown = req.body?.credential;
  if (!config || typeof credential !== "string" || credential.length < 1 || credential.length > 16384) {
    return res.status(400).json({ done: false, body: null });
  }
  void (async () => {
    try {
      const identity = await verifyGoogleCredential(credential, req.sessionID, config);
      const user = await resolveGoogleAccount(identity);
      req.logIn(user, error => {
        if (error) return res.status(500).json({ done: false, body: null });
        return req.session.save(saveError => {
          if (saveError) return res.status(500).json({ done: false, body: null });
          void resolveOrganizationIdForUserId(user.id, user.active_team || null).then(context => {
            if (context) logAuditEvent({ organizationId: context.organizationId, teamId: context.teamId,
              actor: { userId: user.id, name: user.name || user.email }, eventType: AUDIT_EVENT_TYPE.LOGIN_SUCCESS.id });
          }).catch(() => undefined);
          return res.json({ done: true, body: null });
        });
      });
    } catch (error) {
      return res.status(error instanceof GoogleOneTapRejected ? 401 : 500).json({ done: false, body: null });
    }
  })();
});

export default router;
