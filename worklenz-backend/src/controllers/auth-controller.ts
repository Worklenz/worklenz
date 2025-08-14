import bcrypt from "bcrypt";
import passport from "passport";
import {NextFunction} from "express";

import {sendResetEmail, sendResetSuccessEmail} from "../shared/email-templates";

import {ServerResponse} from "../models/server-response";
import {AuthResponse} from "../models/auth-response";

import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import db from "../config/db";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {PasswordStrengthChecker} from "../shared/password-strength-check";
import FileConstants from "../shared/file-constants";
import axios from "axios";
import {log_error} from "../shared/utils";
import {DEFAULT_ERROR_MESSAGE} from "../shared/constants";

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
      // Compare the password
      if (bcrypt.compareSync(currentPassword, data.password)) {
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

  @HandleExceptions({logWithError: "body"})
  public static async reset_password(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const {email} = req.body;

    // Normalize email to lowercase for case-insensitive comparison
    const normalizedEmail = email ? email.toLowerCase().trim() : null;

    const q = `SELECT id, email, google_id, password FROM users WHERE LOWER(email) = $1;`;
    const result = await db.query(q, [normalizedEmail]);

    if (!result.rowCount)
      return res.status(200).send(new ServerResponse(false, null, "Account does not exists!"));

    const [data] = result.rows;

    if (data?.google_id) {
      return res.status(200).send(new ServerResponse(false, null, "Password reset failed!"));
    }

    if (data?.password) {
      const userIdBase64 = Buffer.from(data.id, "utf8").toString("base64");

      const salt = bcrypt.genSaltSync(10);
      const hashedUserData = bcrypt.hashSync(data.id + data.email + data.password, salt);
      const hashedString = hashedUserData.toString().replace(/\//g, "-");

      sendResetEmail(email, userIdBase64, hashedString);
      return res.status(200).send(new ServerResponse(true, null, "Password reset email has been sent to your email. Please check your email."));
    }
    return res.status(200).send(new ServerResponse(false, null, "Email not found!"));
  }

  @HandleExceptions({logWithError: "body"})
  public static async verify_reset_email(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const {user, hash, password} = req.body;
    const hashedString = hash.replace(/\-/g, "/");

    const userId = Buffer.from(user as string, "base64").toString("ascii");

    const q = `SELECT id, email, google_id, password FROM users WHERE id = $1;`;
    const result = await db.query(q, [userId || null]);
    const [data] = result.rows;

    const salt = bcrypt.genSaltSync(10);

    if (bcrypt.compareSync(data.id + data.email + data.password, hashedString)) {
      const encryptedPassword = bcrypt.hashSync(password, salt);
      const updatePasswordQ = `UPDATE users SET password = $1 WHERE id = $2;`;
      await db.query(updatePasswordQ, [encryptedPassword, userId || null]);

      sendResetSuccessEmail(data.email);
      return res.status(200).send(new ServerResponse(true, null, "Password updated successfully"));
    }
    return res.status(200).send(new ServerResponse(false, null, "Invalid Request. Please try again."));
  }

  @HandleExceptions({logWithError: "body"})
  public static async verifyCaptcha(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const {token} = req.body;
    const secretKey = process.env.GOOGLE_CAPTCHA_SECRET_KEY;
    try {
      const response = await axios.post(
        `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`
      );

      const {success, score} = response.data;

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
        return res.status(500).send({
          done: false,
          message: "Authentication failed",
          body: null
        });
      }
      
      if (!user) {
        return res.status(400).send({
          done: false,
          message: info?.message || "Authentication failed",
          body: null
        });
      }
      // Log the user in (create session)
      req.login(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).send({
            done: false,
            message: "Session creation failed",
            body: null
          });
        }
        
        // Add build version
        user.build_v = FileConstants.getRelease();
        
        // Ensure session is saved and cookie is set
        req.session.save((saveErr) => {
          if (saveErr) {
            return res.status(500).send({
              done: false,
              message: "Session save failed",
              body: null
            });
          }
          
          // Get session cookie details
          const sessionName = process.env.SESSION_NAME || 'connect.sid';
          
          // Return response with session info for mobile app to handle
          res.setHeader('X-Session-ID', req.sessionID);
          res.setHeader('X-Session-Name', sessionName);
          
          return res.status(200).send({
            done: true,
            message: "Login successful",
            user,
            authenticated: true,
            sessionId: req.sessionID,
            sessionName: sessionName,
            newSessionId: req.sessionID
          });
        });
      }); // Close login callback
    })(req, res, next);
  }

  @HandleExceptions({logWithError: "body"})
  public static async googleMobileAuth(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const {idToken} = req.body;
    
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
      
      console.log("Token audience (aud):", profile.aud);
      console.log("Allowed client IDs:", allowedClientIds);
      console.log("Environment variables check:");
      console.log("- GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID ? "Set" : "Not set");
      console.log("- GOOGLE_ANDROID_CLIENT_ID:", process.env.GOOGLE_ANDROID_CLIENT_ID ? "Set" : "Not set");
      console.log("- GOOGLE_IOS_CLIENT_ID:", process.env.GOOGLE_IOS_CLIENT_ID ? "Set" : "Not set");
      
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

      // Check for existing local account
      const normalizedProfileEmail = profile.email.toLowerCase().trim();
      const localAccountResult = await db.query("SELECT 1 FROM users WHERE LOWER(email) = $1 AND password IS NOT NULL AND is_deleted IS FALSE;", [normalizedProfileEmail]);
      if (localAccountResult.rowCount) {
        return res.status(400).send(new ServerResponse(false, null, `No Google account exists for email ${profile.email}.`));
      }

      // Check if user exists
      const userResult = await db.query(
        "SELECT id, google_id, name, email, active_team FROM users WHERE google_id = $1 OR LOWER(email) = $2;",
        [profile.sub, normalizedProfileEmail]
      );

      let user: any;
      if (userResult.rowCount) {
        // Existing user - login
        user = userResult.rows[0];
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
