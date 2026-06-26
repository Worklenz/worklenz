import bcrypt from "bcrypt";
import crypto from "crypto";
import passport from "passport";
import { NextFunction } from "express";

import { sendResetEmail, sendResetSuccessEmail } from "../shared/email-templates";

import { ServerResponse } from "../models/server-response";
import { AuthResponse } from "../models/auth-response";

import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import db from "../config/db";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { PasswordStrengthChecker } from "../shared/password-strength-check";
import FileConstants from "../shared/file-constants";
import axios from "axios";
import { log_error } from "../shared/utils";
import { DEFAULT_ERROR_MESSAGE } from "../shared/constants";

export default class AuthController extends WorklenzControllerBase {
  /** This just send ok response to the client when the request came here through the sign-up-validator */
  public static async status_check(_req: IWorkLenzRequest, res: IWorkLenzResponse) {
    return res.status(200).send(new ServerResponse(true, null));
  }

  public static async checkPasswordStrength(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const result = PasswordStrengthChecker.validate(req.query.password as string);
    return res.status(200).send(new ServerResponse(true, result));
  }

  public static verify(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    // Flash messages sent from passport-local-signup.ts and passport-local-login.ts
    const errors = req.flash()["error"] || [];
    const messages = req.flash()["success"] || [];
    // If there are multiple messages, we will send one at a time.
    const auth_error = errors.length > 0 ? errors[0] : null;
    const message = messages.length > 0 ? messages[0] : null;

    // Determine title based on authentication status and strategy
    let title = null;
    if (req.query.strategy) {
      if (auth_error) {
        // Show failure title only when there's an actual error
        title = req.query.strategy === "login" ? "Login Failed!" : "Signup Failed!";
      } else if (req.isAuthenticated() && message) {
        // Show success title when authenticated and there's a success message
        title = req.query.strategy === "login" ? "Login Successful!" : "Signup Successful!";
      }
      // If no error and not authenticated, don't show any title (this might be a redirect without completion)
    }

    if (req.user)
      req.user.build_v = FileConstants.getRelease();

    return res.status(200).send(new AuthResponse(title, req.isAuthenticated(), req.user || null, auth_error, message));
  }

  public static logout(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).send(new AuthResponse(null, true, {}, "Logout failed", null));
      }

      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error("Session destroy error:", destroyErr);
        }
        res.status(200).send(new AuthResponse(null, req.isAuthenticated(), {}, null, null));
      });
    });
  }

  private static async destroyOtherSessions(userId: string, sessionId: string) {
    try {
      const q = `DELETE FROM pg_sessions WHERE (sess ->> 'passport')::JSON ->> 'user'::TEXT = $1 AND sid != $2;`;
      await db.query(q, [userId, sessionId]);
    } catch (error) {
      // ignored
    }
  }

  @HandleExceptions()
  public static async changePassword(req: IWorkLenzRequest, res: IWorkLenzResponse) {

    const currentPassword = req.body.password;
    const newPassword = req.body.new_password;

    const q = `SELECT id, email, google_id, password FROM users WHERE id = $1;`;
    const result = await db.query(q, [req.user?.id || null]);
    const [data] = result.rows;

    if (data) {
      // Compare the current password
      if (bcrypt.compareSync(currentPassword, data.password)) {

        // Prevent reusing the same password
        const isSamePassword = bcrypt.compareSync(newPassword, data.password);
        if (isSamePassword) {
          return res.status(200).send(new ServerResponse(false, null, "New password must be different from your current password."));
        }

        const salt = bcrypt.genSaltSync(10);
        const encryptedPassword = bcrypt.hashSync(newPassword, salt);

        const updatePasswordQ = `UPDATE users SET password = $1 WHERE id = $2;`;
        await db.query(updatePasswordQ, [encryptedPassword, req.user?.id || null]);

        if (req.user?.id)
          AuthController.destroyOtherSessions(req.user.id, req.sessionID);

        return res.status(200).send(new ServerResponse(true, null, "Password updated successfully!"));
      }

      return res.status(200).send(new ServerResponse(false, null, "Old password does not match!"));
    }
  }

  @HandleExceptions({ logWithError: "body" })
  public static async reset_password(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const { email } = req.body;

    // Normalize email to lowercase for case-insensitive comparison
    const normalizedEmail = email ? email.toLowerCase().trim() : null;

    // Security: Always return the same generic message to prevent email enumeration
    const GENERIC_SUCCESS_MESSAGE = "If an account with that email exists, a password reset link has been sent to your email.";

    // Timing attack mitigation: enforce a minimum response time so response duration
    // cannot be used to determine whether an account exists.
    const MIN_RESPONSE_MS = 800;
    const requestStart = Date.now();
    const sendGenericResponse = async () => {
      const elapsed = Date.now() - requestStart;
      if (elapsed < MIN_RESPONSE_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_MS - elapsed));
      }
      return res.status(200).send(new ServerResponse(true, null, GENERIC_SUCCESS_MESSAGE));
    };

    const q = `SELECT id, email, google_id, apple_id, password FROM users WHERE LOWER(email) = $1;`;
    const result = await db.query(q, [normalizedEmail]);

    if (!result.rowCount) {
      return sendGenericResponse();
    }

    const [data] = result.rows;

    // For OAuth-only accounts (Google/Apple), don't send reset email
    if (data?.google_id || data?.apple_id) {
      log_error(`Password reset attempted for OAuth account: ${normalizedEmail}`, null);
      return sendGenericResponse();
    }

    // Only send reset email if account exists and has a password
    if (data?.password) {
      try {
        const userIdBase64 = Buffer.from(data.id, "utf8").toString("base64");

        // Generate a cryptographically random URL-safe token (hex, no special chars)
        const token = crypto.randomBytes(32).toString("hex");
        // Store SHA-256 hash of the token in DB (never store raw token)
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

        // Invalidate all previous unused tokens for this user
        await db.query(
          `UPDATE password_reset_tokens
           SET is_used = TRUE
           WHERE user_id = $1 AND is_used = FALSE`,
          [data.id]
        );

        // Opportunistically clean up expired tokens to keep the table lean
        await db.query(
          `DELETE FROM password_reset_tokens
           WHERE expires_at < NOW() - INTERVAL '7 days'`
        );

        // Store the token hash in the database with 1 hour expiration
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        await db.query(
          `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
           VALUES ($1, $2, $3)`,
          [data.id, tokenHash, expiresAt]
        );

        // Send raw token in email URL (hex only, completely URL-safe)
        await sendResetEmail(email, userIdBase64, token);
      } catch (error) {
        // Log error internally but don't expose to client
        log_error(`Failed to send password reset email for: ${normalizedEmail}`, error);
      }
    }

    return sendGenericResponse();
  }

  @HandleExceptions({ logWithError: "body" })
  public static async verify_reset_email(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const { user, hash, password } = req.body;

    // Validate token format before touching the DB: must be a 64-char hex string
    if (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)) {
      return res.status(200).send(new ServerResponse(false, null, "Invalid reset link. Please request a new password reset."));
    }

    const userId = Buffer.from(user as string, "base64").toString("ascii");

    // hash is the raw random token (hex); look it up by its SHA-256 hash
    const tokenHash = crypto.createHash("sha256").update(hash).digest("hex");

    const tokenCheck = await db.query(
      `SELECT id, user_id, expires_at, is_used
       FROM password_reset_tokens
       WHERE token_hash = $1 AND is_used = FALSE AND expires_at > NOW()`,
      [tokenHash]
    );

    if (!tokenCheck.rowCount) {
      return res.status(200).send(new ServerResponse(false, null, "Invalid or expired reset link. Please request a new password reset."));
    }

    const tokenData = tokenCheck.rows[0];

    // Verify the user ID from the URL matches the token owner
    if (tokenData.user_id !== userId) {
      return res.status(200).send(new ServerResponse(false, null, "Invalid reset link. Please request a new password reset."));
    }

    // Get user data
    const q = `SELECT id, email FROM users WHERE id = $1;`;
    const result = await db.query(q, [userId || null]);

    if (!result.rowCount) {
      return res.status(200).send(new ServerResponse(false, null, "User not found. Please request a new password reset."));
    }

    const [data] = result.rows;

    // Update password
    const salt = bcrypt.genSaltSync(10);
    const encryptedPassword = bcrypt.hashSync(password, salt);
    await db.query(`UPDATE users SET password = $1 WHERE id = $2;`, [encryptedPassword, userId || null]);

    // Mark token as used
    await db.query(
      `UPDATE password_reset_tokens SET is_used = TRUE, used_at = NOW() WHERE id = $1`,
      [tokenData.id]
    );

    // Invalidate all other unused tokens for this user (defense in depth)
    await db.query(
      `UPDATE password_reset_tokens
       SET is_used = TRUE
       WHERE user_id = $1 AND is_used = FALSE AND id != $2`,
      [userId, tokenData.id]
    );

    // Invalidate ALL existing sessions for this user so compromised sessions
    // cannot survive a password reset (changePassword does the same for its own context)
    try {
      await db.query(
        `DELETE FROM pg_sessions WHERE (sess ->> 'passport')::JSON ->> 'user'::TEXT = $1`,
        [userId]
      );
    } catch (error) {
      // Non-fatal: log but don't block the successful reset response
      log_error("Failed to invalidate sessions after password reset", error);
    }

    sendResetSuccessEmail(data.email);
    return res.status(200).send(new ServerResponse(true, null, "Password updated successfully"));
  }

  @HandleExceptions({ logWithError: "body" })
  public static async verifyCaptcha(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const { token } = req.body;
    const secretKey = process.env.GOOGLE_CAPTCHA_SECRET_KEY;
    try {
      const response = await axios.post(
        `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`
      );

      const { success, score } = response.data;

      if (success && score > 0.5) {
        return res.status(200).send(new ServerResponse(true, null, null));
      }
      return res.status(400).send(new ServerResponse(false, null, "Please try again later.").withTitle("Error"));
    } catch (error) {
      log_error(error);
      res.status(500).send(new ServerResponse(false, null, DEFAULT_ERROR_MESSAGE));
    }
  }

  public static googleMobileAuthPassport(req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) {

    const mobileOptions = {
      session: true,
      failureFlash: true,
      failWithError: false
    };

    passport.authenticate("google-mobile", mobileOptions, (err: any, user: any, info: any) => {
      if (err) {
        log_error("Google mobile authentication error:", err);
        return res.status(500).send({
          done: false,
          message: "Authentication failed",
          body: null,
          errorCode: "AUTHENTICATION_ERROR"
        });
      }

      if (!user) {
        // Extract error code if present
        const errorCode = info?.ERROR_KEY || "AUTHENTICATION_FAILED";
        const statusCode = errorCode === "USER_NOT_FOUND" ? 404 : 400;

        return res.status(statusCode).send({
          done: false,
          message: info?.message || "Authentication failed",
          body: null,
          errorCode
        });
      }

      // Log the user in (create session)
      req.login(user, (loginErr) => {
        if (loginErr) {
          log_error("Google login session creation error:", loginErr);
          return res.status(500).send({
            done: false,
            message: "Session creation failed",
            body: null,
            errorCode: "SESSION_CREATION_FAILED"
          });
        }

        // Add build version
        user.build_v = FileConstants.getRelease();

        // Ensure session is saved and cookie is set
        req.session.save((saveErr) => {
          if (saveErr) {
            log_error("Google login session save error:", saveErr);
            return res.status(500).send({
              done: false,
              message: "Session save failed",
              body: null,
              errorCode: "SESSION_SAVE_FAILED"
            });
          }

          // Get session cookie details
          const sessionName = process.env.SESSION_NAME || 'connect.sid';

          // Return response with session info for mobile app to handle
          res.setHeader('X-Session-ID', req.sessionID);
          res.setHeader('X-Session-Name', sessionName);

          return res.status(200).send({
            done: true,
            message: info?.message || "Login successful",
            user,
            authenticated: true,
            sessionId: req.sessionID,
            sessionName: sessionName,
            newSessionId: req.sessionID
          });
        });
      });
    })(req, res, next);
  }

  /**
   * Apple Mobile Authentication Handler
   * Handles Apple Sign-In for mobile apps using Passport strategy
   * Similar to googleMobileAuthPassport but for Apple
   */
  public static appleMobileAuthPassport(req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction) {
    const mobileOptions = {
      session: true,
      failureFlash: true,
      failWithError: false
    };

    passport.authenticate("apple-mobile", mobileOptions, (err: any, user: any, info: any) => {
      // Handle authentication errors
      if (err) {
        log_error("Apple mobile authentication error:", err);
        return res.status(500).send({
          done: false,
          message: "Authentication failed",
          body: null,
          errorCode: "AUTHENTICATION_ERROR"
        });
      }

      // Handle authentication failure (invalid token, user not found, etc.)
      if (!user) {
        // Extract error code if present
        const errorCode = info?.ERROR_KEY || "AUTHENTICATION_FAILED";
        const statusCode = errorCode === "USER_NOT_FOUND" ? 404 : 400;

        return res.status(statusCode).send({
          done: false,
          message: info?.message || "Apple authentication failed",
          body: null,
          errorCode
        });
      }

      // Log the user in (create session)
      req.login(user, (loginErr) => {
        if (loginErr) {
          log_error("Apple login session creation error:", loginErr);
          return res.status(500).send({
            done: false,
            message: "Session creation failed",
            body: null,
            errorCode: "SESSION_CREATION_FAILED"
          });
        }

        // Add build version to user object
        user.build_v = FileConstants.getRelease();

        // Ensure session is saved and cookie is set
        req.session.save((saveErr) => {
          if (saveErr) {
            log_error("Apple login session save error:", saveErr);
            return res.status(500).send({
              done: false,
              message: "Session save failed",
              body: null,
              errorCode: "SESSION_SAVE_FAILED"
            });
          }

          // Get session cookie details
          const sessionName = process.env.SESSION_NAME || 'worklenz.sid';

          // Return response with session info for mobile app
          res.setHeader('X-Session-ID', req.sessionID);
          res.setHeader('X-Session-Name', sessionName);

          return res.status(200).send({
            done: true,
            message: info?.message || "Login successful",
            user,
            authenticated: true,
            sessionId: req.sessionID,
            sessionName: sessionName,
            newSessionId: req.sessionID
          });
        });
      });
    })(req, res, next);
  }

  @HandleExceptions({ logWithError: "body" })
  public static async googleMobileAuth(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).send(new ServerResponse(false, null, "ID token is required"));
    }

    try {
      const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      const profile = response.data;

      // Validate token audience (client ID) - accept web, Android, and iOS client IDs
      const allowedClientIds = [
        process.env.GOOGLE_CLIENT_ID, // Web client ID
        process.env.GOOGLE_ANDROID_CLIENT_ID, // Android client ID
        process.env.GOOGLE_IOS_CLIENT_ID, // iOS client ID
      ].filter(Boolean); // Remove undefined values

      if (!allowedClientIds.includes(profile.aud)) {
        return res.status(400).send(new ServerResponse(false, null, "Invalid token audience"));
      }

      // Validate token issuer
      if (!["https://accounts.google.com", "accounts.google.com"].includes(profile.iss)) {
        return res.status(400).send(new ServerResponse(false, null, "Invalid token issuer"));
      }

      // Check token expiry
      if (Date.now() >= profile.exp * 1000) {
        return res.status(400).send(new ServerResponse(false, null, "Token expired"));
      }

      if (!profile.email_verified) {
        return res.status(400).send(new ServerResponse(false, null, "Email not verified"));
      }

      const normalizedProfileEmail = profile.email.toLowerCase().trim();

      // Check if user exists (exclude deleted accounts)
      const userResult = await db.query(
        "SELECT id, google_id, name, email, active_team FROM users WHERE (google_id = $1 OR LOWER(email) = $2) AND is_deleted = FALSE;",
        [profile.sub, normalizedProfileEmail]
      );

      let user: any;
      if (userResult.rowCount) {
        // Existing user - login
        user = userResult.rows[0];

        // Link Google account if user signed up with email/password but google_id is not set
        if (!user.google_id && profile.sub) {
          try {
            await db.query("UPDATE users SET google_id = $1 WHERE id = $2;", [profile.sub, user.id]);
            user.google_id = profile.sub;
          } catch (error) {
            log_error(error);
          }
        }
      } else {
        // New user - register
        const googleUserData = {
          id: profile.sub,
          displayName: profile.name,
          email: normalizedProfileEmail,
          picture: profile.picture
        };

        const registerResult = await db.query("SELECT register_google_user($1) AS user;", [JSON.stringify(googleUserData)]);
        user = registerResult.rows[0].user;
      }

      // Create session
      req.login(user, (err) => {
        if (err) {
          log_error(err);
          return res.status(500).send(new ServerResponse(false, null, "Authentication failed"));
        }

        user.build_v = FileConstants.getRelease();
        return res.status(200).send(new AuthResponse("Login Successful!", true, user, null, "User successfully logged in"));
      });

    } catch (error) {
      log_error(error);
      return res.status(400).send(new ServerResponse(false, null, "Invalid ID token"));
    }
  }
}
