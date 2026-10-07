import express from "express";
import passport from "passport";

import AuthController from "../../controllers/auth-controller";

import signUpValidator from "../../middlewares/validators/sign-up-validator";
import resetEmailValidator from "../../middlewares/validators/reset-email-validator";
import updatePasswordValidator from "../../middlewares/validators/update-password-validator";
import passwordValidator from "../../middlewares/validators/password-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import FileConstants from "../../shared/file-constants";
import { log_error } from "../../shared/utils";
import { resetPasswordLimiter, updatePasswordLimiter } from "../../middlewares/reset-password-rate-limiter";
import { logAuditEvent, resolveOrganizationIdForUserId } from "../../services/audit-log.service";
import { AUDIT_EVENT_TYPE } from "../../shared/audit-log-constants";

// Spec #32, task 3.1: logs login_success for the OAuth web callbacks below. Failures aren't
// instrumented here - OAuth failures are almost always provider/token-level (expired code,
// network issue) rather than an access-control event against a specific workspace, and
// Google/Apple sign-in are consumer OAuth, not a customer-configurable SSO integration (see
// shared/audit-log-constants.ts's note on spike task 0.8).
function logOAuthLoginSuccess(user: any): void {
  if (!user?.id) return;
  void (async () => {
    const context = await resolveOrganizationIdForUserId(user.id, user.active_team || null);
    if (!context) return;
    logAuditEvent({
      organizationId: context.organizationId,
      teamId: context.teamId,
      actor: { userId: user.id, name: user.name || user.email || "Unknown user" },
      eventType: AUDIT_EVENT_TYPE.LOGIN_SUCCESS.id,
    });
  })();
}

const authRouter = express.Router();

const isGoogleOAuthConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== "disabled" &&
    process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CLIENT_SECRET !== "disabled" &&
    process.env.GOOGLE_CALLBACK_URL
);

// Local authentication
const options = (key: string): passport.AuthenticateOptions => ({
  failureRedirect: `/secure/verify?strategy=${key}`,
  successRedirect: `/secure/verify?strategy=${key}`
});

authRouter.post("/login", passport.authenticate("local-login", options("login")));
authRouter.post("/signup", signUpValidator, passwordValidator, passport.authenticate("local-signup", options("signup")));
authRouter.post("/signup/check", signUpValidator, passwordValidator, safeControllerFunction(AuthController.status_check));
authRouter.get("/verify", AuthController.verify);
authRouter.post("/check-password", safeControllerFunction(AuthController.checkPasswordStrength));

authRouter.post("/reset-password", resetPasswordLimiter, resetEmailValidator, safeControllerFunction(AuthController.reset_password));
authRouter.post("/update-password", updatePasswordLimiter, updatePasswordValidator, passwordValidator, safeControllerFunction(AuthController.verify_reset_email));

authRouter.post("/verify-captcha", safeControllerFunction(AuthController.verifyCaptcha));

// Google authentication
authRouter.get("/google", (req, res, next) => {
  if (!isGoogleOAuthConfigured) {
    return res.status(503).json({ message: "Google sign-in is not configured" });
  }

  return passport.authenticate("google", {
    scope: ["email", "profile"],
    state: JSON.stringify({
      teamMember: req.query.teamMember || null,
      team: req.query.team || null,
      teamName: req.query.teamName || null,
      project: req.query.project || null
    })
  })(req, res, next);
});

authRouter.get("/google/verify", (req, res, next) => {
  if (!isGoogleOAuthConfigured) {
    return res.status(503).json({ message: "Google sign-in is not configured" });
  }

  let sessionError = "";
  if ((req.session as any).error) {
    sessionError = `?error=${encodeURIComponent((req.session as any).error as string)}`;
    delete (req.session as any).error;
  }

  const failureRedirect = process.env.LOGIN_FAILURE_REDIRECT + sessionError;
  const successRedirect = process.env.LOGIN_SUCCESS_REDIRECT as string;

  passport.authenticate("google", (err: any, user: any, info: any) => {
    if (err) {
      console.error("[Google OAuth] verify callback error:", err?.message || err);
      console.error("[Google OAuth] verify error object:", JSON.stringify(err, Object.getOwnPropertyNames(err || {})));
      log_error(err);
      return res.redirect(failureRedirect || "/");
    }

    if (!user) {
      console.error("[Google OAuth] verify - no user returned. info:", JSON.stringify(info));
      return res.redirect(failureRedirect || "/");
    }

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error("[Google OAuth] session login error:", loginErr?.message || loginErr);
        log_error(loginErr);
        return res.redirect(failureRedirect || "/");
      }
      logOAuthLoginSuccess(user);
      return res.redirect(successRedirect || "/");
    });
  })(req, res, next);
});

// Mobile Google Sign-In using Passport strategy
authRouter.post("/google/mobile", AuthController.googleMobileAuthPassport);

// Mobile Apple Sign-In using Passport strategy
authRouter.post("/apple/mobile", AuthController.appleMobileAuthPassport);

// Apple Web OAuth authentication
authRouter.get("/apple", (req, res, next) => {
  return passport.authenticate("apple", {
    scope: ["name", "email"],
    state: JSON.stringify({
      teamMember: req.query.teamMember || null,
      team: req.query.team || null,
      teamName: req.query.teamName || null,
      project: req.query.project || null
    })
  })(req, res, next);
});

authRouter.post("/apple/verify", (req, res, next) => {
  let error = "";
  if ((req.session as any).error) {
    error = `?error=${encodeURIComponent((req.session as any).error as string)}`;
    delete (req.session as any).error;
  }

  const failureRedirect = process.env.LOGIN_FAILURE_REDIRECT + error;
  const successRedirect = process.env.LOGIN_SUCCESS_REDIRECT as string;

  // Converted from the declarative { failureRedirect, successRedirect } form to a custom
  // callback (mirroring /google/verify above) solely so logOAuthLoginSuccess(user) has a
  // place to run before the redirect — behavior is otherwise unchanged.
  passport.authenticate("apple", (err: any, user: any, info: any) => {
    if (err) {
      log_error(err);
      return res.redirect(failureRedirect || "/");
    }

    if (!user) {
      return res.redirect(failureRedirect || "/");
    }

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        log_error(loginErr);
        return res.redirect(failureRedirect || "/");
      }
      logOAuthLoginSuccess(user);
      return res.redirect(successRedirect || "/");
    });
  })(req, res, next);
});

// Passport logout
authRouter.get("/logout", AuthController.logout);

export default authRouter;
