import bcrypt from "bcrypt";

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

    const q = `SELECT id, email, google_id, password FROM users WHERE email = $1;`;
    const result = await db.query(q, [email || null]);

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
}
