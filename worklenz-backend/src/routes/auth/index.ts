import express from "express";
import passport from "passport";
import { Request, Response, NextFunction } from "express";

import AuthController from "../../controllers/auth-controller";

import signUpValidator from "../../middlewares/validators/sign-up-validator";
import resetEmailValidator from "../../middlewares/validators/reset-email-validator";
import updatePasswordValidator from "../../middlewares/validators/update-password-validator";
import passwordValidator from "../../middlewares/validators/password-validator";
import safeControllerFunction from "../../shared/safe-controller-function";
import FileConstants from "../../shared/file-constants";
import { log_error } from "../../shared/utils";
import { resetPasswordLimiter, updatePasswordLimiter } from "../../middlewares/reset-password-rate-limiter";
import { AuthResponse } from "../../models/auth-response";
import { ServerResponse } from "../../models/server-response";

const authRouter = express.Router();

const isGoogleOAuthConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== "disabled" &&
    process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CLIENT_SECRET !== "disabled" &&
    process.env.GOOGLE_CALLBACK_URL
);

// Helper to detect AJAX/API requests
const isApiRequest = (req: Request): boolean => {
  const accept = req.headers.accept || "";
  const contentType = req.headers["content-type"] || "";
  const xRequestedWith = req.headers["x-requested-with"];
  return accept.includes("application/json") || contentType.includes("application/json") || xRequestedWith === "XMLHttpRequest";
};

// Custom passport callback for API requests
const apiAuthCallback = (strategy: string) => (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate(strategy, (err: any, user: any, info: any) => {
    if (err) {
      log_error(err, req.body);
      return res.status(500).send(new ServerResponse(false, null, "Authentication failed"));
    }

    if (!user) {
      const errorMsg = info?.message || (strategy === "local-login" ? "Incorrect email or password" : "Signup failed");
      return res.status(401).send(new AuthResponse(`${strategy === "local-login" ? "Login" : "Signup"} Failed!`, false, null, errorMsg, null));
    }

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        log_error(loginErr);
        return res.status(500).send(new ServerResponse(false, null, "Session creation failed"));
      }

      req.session.save((saveErr) => {
        if (saveErr) {
          log_error(saveErr);
          return res.status(500).send(new ServerResponse(false, null, "Session save failed"));
        }

        user.build_v = FileConstants.getRelease();
        user.appsumo_popup_frequency_days = getAppSumoPopupFrequencyDays?.() || 7;

        return res.status(200).send(new AuthResponse(`${strategy === "local-login" ? "Login" : "Signup"} Successful!`, true, user, null, "User successfully logged in"));
      });
    });
  })(req, res, next);
};

// Traditional form-based authentication (redirects)
const formAuthOptions = (key: string): passport.AuthenticateOptions => ({
  failureRedirect: `/secure/verify?strategy=${key}`,
  successRedirect: `/secure/verify?strategy=${key}`
});

// Local authentication - supports both form and API requests
authRouter.post("/login", (req, res, next) => {
  if (isApiRequest(req)) {
    return apiAuthCallback("local-login")(req, res, next);
  }
  return passport.authenticate("local-login", formAuthOptions("login"))(req, res, next);
});

authRouter.post("/signup", signUpValidator, passwordValidator, (req, res, next) => {
  if (isApiRequest(req)) {
    return apiAuthCallback("local-signup")(req, res, next);
  }
  return passport.authenticate("local-signup", formAuthOptions("signup"))(req, res, next);
});
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
  return passport.authenticate("apple", {
    failureRedirect,
    successRedirect: process.env.LOGIN_SUCCESS_REDIRECT
  })(req, res, next);
});

// Passport logout
authRouter.get("/logout", AuthController.logout);

export default authRouter;
