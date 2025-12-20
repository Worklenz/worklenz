import bcrypt from "bcrypt";
import passport from "passport";
import { NextFunction, Response } from "express";

import { sendResetEmail, sendResetSuccessEmail, sendWelcomeEmail } from "../shared/email-templates";

import { ServerResponse } from "../models/server-response";
import { AuthResponse } from "../models/auth-response";

import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { IPassportSession } from "../interfaces/passport-session";
import db from "../config/db";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { PasswordStrengthChecker } from "../shared/password-strength-check";
import FileConstants from "../shared/file-constants";
import axios from "axios";
import { isProduction, log_error, getBrandName } from "../shared/utils";
import { DEFAULT_ERROR_MESSAGE } from "../shared/constants";
import TokenService from "../services/auth/token.service";
import UserSessionService from "../services/auth/user-session.service";

export default class AuthController extends WorklenzControllerBase {

  private static attachRefreshCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(TokenService.getRefreshCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction(),
      expires: expiresAt,
      path: "/"
    });
  }

  private static clearRefreshCookie(res: Response) {
    res.cookie(TokenService.getRefreshCookieName(), "", {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction(),
      expires: new Date(0),
      path: "/"
    });
  }

  private static getRefreshTokenFromRequest(req: IWorkLenzRequest) {
    const cookieName = TokenService.getRefreshCookieName();
    const cookies = (req as any).cookies;
    return cookies?.[cookieName] || req.headers["x-refresh-token"] || req.body?.refresh_token;
  }

  private static async respondWithAuthenticatedUser(req: IWorkLenzRequest, res: IWorkLenzResponse, user: IPassportSession, message: string) {
    user.build_v = FileConstants.getRelease();
    const tokens = await TokenService.issueTokens(user, {
      userAgent: req.headers["user-agent"] as string | undefined,
      ip: req.ip
    });

    AuthController.attachRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);

    return res.status(200).send(new AuthResponse("Login Successful!", true, user, null, message, {
      access_token: tokens.accessToken,
      expires_in: tokens.accessTokenExpiresIn
    }));
  }

  private static async resolveUserFromRequest(req: IWorkLenzRequest) {
    if (req.user?.id) {
      return req.user;
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;
    if (!token) return null;

    try {
      const payload = await TokenService.verifyAccessToken(token);
      return await UserSessionService.loadByUserId(payload.sub);
    } catch (error) {
      return null;
    }
  }

  private static accountBlockedResponse(status: string, rejectionReason?: string | null) {
    if (status === "pending") {
      return new AuthResponse("Account Pending Approval", false, null, "Account pending approval", `Your ${getBrandName()} account is awaiting approval.`);
    }

    if (status === "rejected") {
      const reason = rejectionReason ? ` Reason: ${rejectionReason}` : "";
      return new AuthResponse("Account Rejected", false, null, "Account rejected", `Your access request was rejected.${reason}`);
    }

    return new AuthResponse("Authentication Failed", false, null, "Account unavailable", "Your account is disabled.");
  }

  /** This just send ok response to the client when the request came here through the sign-up-validator */
  public static async status_check(_req: IWorkLenzRequest, res: IWorkLenzResponse) {
    return res.status(200).send(new ServerResponse(true, null));
  }

  @HandleExceptions({ logWithError: "body" })
  public static async login(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).send(new AuthResponse("Login Failed", false, null, "Missing credentials", "Please provide both email and password."));
    }

    const normalizedEmail = (email as string).toLowerCase().trim();

    // Super Admin Check
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (adminEmail && adminPassword && normalizedEmail === adminEmail.toLowerCase().trim()) {
      if (password === adminPassword) {
        const user = await UserSessionService.loadByUserId("00000000-0000-0000-0000-000000000000");
        if (user) {
          return this.respondWithAuthenticatedUser(req, res, user, "Admin successfully logged in");
        }
      }
      return res.status(401).send(new AuthResponse("Login Failed", false, null, "Authentication failed", "Incorrect email or password."));
    }

    const q = `SELECT id, email, password, account_status, rejection_reason
               FROM users
               WHERE LOWER(email) = $1
                 AND google_id IS NULL
                 AND is_deleted IS FALSE;`;
    const result = await db.query(q, [normalizedEmail]);
    const [data] = result.rows;

    if (!data?.password) {
      return res.status(401).send(new AuthResponse("Login Failed", false, null, "Authentication failed", `No ${getBrandName()} account found for this email.`));
    }

    const passwordMatch = bcrypt.compareSync(password, data.password);

    if (!passwordMatch) {
      return res.status(401).send(new AuthResponse("Login Failed", false, null, "Authentication failed", "Incorrect email or password."));
    }

    if (data.account_status !== "approved") {
      const blockedResponse = AuthController.accountBlockedResponse(data.account_status, data.rejection_reason);
      return res.status(403).send(blockedResponse);
    }

    const user = await UserSessionService.loadByUserId(data.id);

    if (!user) {
      return res.status(500).send(new AuthResponse("Login Failed", false, null, null, "Unable to load your profile. Please try again."));
    }

    return this.respondWithAuthenticatedUser(req, res, user, "User successfully logged in");
  }

  @HandleExceptions({ logWithError: "body" })
  public static async signUp(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const { email, password, team_id, name, team_name, timezone, team_member_id } = req.body;

    if (!team_name) {
      return res.status(400).send(new ServerResponse(false, null, "Team name is required"));
    }

    if (await this.isGoogleAccountFound(email)) {
      return res.status(400).send(new ServerResponse(false, null, `${email} is already linked with a Google account.`));
    }

    if (await this.isAccountDeactivated(email)) {
      return res.status(400).send(new ServerResponse(false, null, `Account for email ${email} has been deactivated. Please contact support to reactivate your account.`));
    }

    try {
      await this.registerUser(password, team_id, name, team_name, email, timezone, team_member_id);
      sendWelcomeEmail(email, name);
      return res.status(201).send(new ServerResponse(true, null, "Registration successful. Your account will be available once approved."));
    } catch (error: any) {
      const message = (error?.message) || "";

      if (message === "ERROR_INVALID_JOINING_EMAIL") {
        return res.status(400).send(new ServerResponse(false, null, `No invitations found for email ${email}.`));
      }

      if (message.includes("EMAIL_EXISTS_ERROR") || error.constraint === "users_google_id_uindex") {
        const [, value] = error.message.split(":");
        return res.status(400).send(new ServerResponse(false, null, `${getBrandName()} account already exists for email ${value}.`));
      }

      if (message.includes("TEAM_NAME_EXISTS_ERROR")) {
        const [, value] = error.message.split(":");
        return res.status(400).send(new ServerResponse(false, null, `Team name "${value}" already exists. Please choose a different team name.`));
      }

      if (error.constraint === "teams_url_uindex" || error.constraint === "teams_name_uindex") {
        return res.status(400).send(new ServerResponse(false, null, `Team name "${team_name}" is already taken. Please choose a different team name.`));
      }

      log_error(error, req.body);
      return res.status(500).send(new ServerResponse(false, null, DEFAULT_ERROR_MESSAGE));
    }
  }

  public static async checkPasswordStrength(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const result = PasswordStrengthChecker.validate(req.query.password as string);
    return res.status(200).send(new ServerResponse(true, result));
  }

  public static async verify(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const user = await AuthController.resolveUserFromRequest(req);

    if (!user) {
      return res.status(200).send(new AuthResponse(null, false, null, "Not authenticated", "Please log in to continue."));
    }

    user.build_v = FileConstants.getRelease();

    return res.status(200).send(new AuthResponse("Authenticated", true, user, null, null));
  }

  public static logout(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const refreshToken = AuthController.getRefreshTokenFromRequest(req);
    void TokenService.revokeRefreshToken(refreshToken as string);
    AuthController.clearRefreshCookie(res);

    const finalize = () => {
      if (req.session) {
        req.session.destroy(() => {
          res.status(200).send(new ServerResponse(true, null, "Logged out successfully"));
        });
      } else {
        res.status(200).send(new ServerResponse(true, null, "Logged out successfully"));
      }
    };

    const passportLogout = (req as any).logout;
    if (typeof passportLogout === "function") {
      passportLogout.call(req, (err: any) => {
        if (err) {
          console.error("Logout error:", err);
          return res.status(500).send(new ServerResponse(false, null, "Logout failed"));
        }
        finalize();
      });
    } else {
      finalize();
    }
  }

  @HandleExceptions()
  public static async refreshToken(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const existingToken = AuthController.getRefreshTokenFromRequest(req);

    if (!existingToken) {
      return res.status(401).send(new ServerResponse(false, null, "Refresh token is missing"));
    }

    const record = await TokenService.findValidRefreshToken(existingToken as string);

    if (!record) {
      await TokenService.revokeRefreshToken(existingToken as string);
      AuthController.clearRefreshCookie(res);
      return res.status(401).send(new ServerResponse(false, null, "Refresh token is invalid or expired"));
    }

    const user = await UserSessionService.loadByUserId(record.user_id);

    if (!user) {
      await TokenService.revokeRefreshToken(existingToken as string);
      AuthController.clearRefreshCookie(res);
      return res.status(401).send(new ServerResponse(false, null, "Unable to refresh session"));
    }

    if (user.account_status !== "approved") {
      await TokenService.revokeRefreshToken(existingToken as string);
      AuthController.clearRefreshCookie(res);
      return res.status(403).send(AuthController.accountBlockedResponse(user.account_status || "pending", user.rejection_reason));
    }

    const tokens = await TokenService.replaceRefreshToken(existingToken as string, user, {
      userAgent: req.headers["user-agent"] as string | undefined,
      ip: req.ip
    });

    AuthController.attachRefreshCookie(res, tokens.refreshToken, tokens.refreshTokenExpiresAt);

    return res.status(200).send(new AuthResponse("Token Refreshed", true, user, null, "Session refreshed", {
      access_token: tokens.accessToken,
      expires_in: tokens.accessTokenExpiresIn
    }));
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
          await TokenService.revokeAllUserTokens(req.user.id);

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

  @HandleExceptions({ logWithError: "body" })
  public static async verify_reset_email(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const { user, hash, password } = req.body;
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

      await TokenService.revokeAllUserTokens(userId);
      sendResetSuccessEmail(data.email);
      return res.status(200).send(new ServerResponse(true, null, "Password updated successfully"));
    }
    return res.status(200).send(new ServerResponse(false, null, "Invalid Request. Please try again."));
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
        "SELECT id, google_id, name, email, active_team, account_status, rejection_reason FROM users WHERE google_id = $1 OR LOWER(email) = $2;",
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

      if (user.account_status !== "approved") {
        return res.status(403).send(AuthController.accountBlockedResponse(user.account_status, user.rejection_reason));
      }

      const sessionUser = await UserSessionService.loadByUserId(user.id);
      if (!sessionUser) {
        return res.status(500).send(new ServerResponse(false, null, "Authentication failed"));
      }

      return this.respondWithAuthenticatedUser(req, res, sessionUser, "User successfully logged in");

    } catch (error) {
      log_error(error);
      return res.status(400).send(new ServerResponse(false, null, "Invalid ID token"));
    }
  }

  private static async isGoogleAccountFound(email: string) {
    const q = `
      SELECT 1
      FROM users
      WHERE LOWER(email) = $1
        AND google_id IS NOT NULL;
    `;
    const result = await db.query(q, [email.toLowerCase().trim()]);
    return !!result.rowCount;
  }

  private static async isAccountDeactivated(email: string) {
    const q = `
      SELECT 1
      FROM users
      WHERE LOWER(email) = $1
        AND is_deleted = TRUE;
    `;
    const result = await db.query(q, [email.toLowerCase().trim()]);
    return !!result.rowCount;
  }

  private static async registerUser(password: string, team_id: string, name: string, team_name: string, email: string, timezone: string, team_member_id: string) {
    const salt = bcrypt.genSaltSync(10);
    const encryptedPassword = bcrypt.hashSync(password, salt);

    const teamId = team_id || null;
    const q = "SELECT register_user($1) AS user;";

    const body = {
      name,
      team_name,
      email: email.toLowerCase().trim(),
      password: encryptedPassword,
      timezone,
      invited_team_id: teamId,
      team_member_id,
    };

    const result = await db.query(q, [JSON.stringify(body)]);
    const [data] = result.rows;
    return data.user;
  }
}
