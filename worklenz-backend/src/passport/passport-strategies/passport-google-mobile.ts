import { Strategy as CustomStrategy } from "passport-custom";
import axios from "axios";
import { Request } from "express";
import db from "../../config/db";
import { log_error } from "../../shared/utils";
import { ERROR_KEY } from "./passport-constants";

interface GoogleTokenProfile {
  sub: string;
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
  aud: string;
  iss: string;
  exp: number;
}

async function handleMobileGoogleAuth(req: Request, done: any) {
  try {
    const { idToken, isSignUp, team_name, timezone } = req.body;

    if (!idToken) {
      return done(null, false, { message: "ID token is required" });
    }

    // Verify Google ID token
    const response = await axios.get(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
    );
    const profile: GoogleTokenProfile = response.data;

    // Validate token audience (client ID)
    const allowedClientIds = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
    ].filter(Boolean);

    if (!allowedClientIds.includes(profile.aud)) {
      return done(null, false, { message: "Invalid token audience" });
    }

    // Validate token issuer
    if (
      !["https://accounts.google.com", "accounts.google.com"].includes(
        profile.iss
      )
    ) {
      return done(null, false, { message: "Invalid token issuer" });
    }

    // Check token expiry
    if (Date.now() >= profile.exp * 1000) {
      return done(null, false, { message: "Token expired" });
    }

    if (!profile.email_verified) {
      return done(null, false, { message: "Email not verified" });
    }

    const normalizedEmail = profile.email.toLowerCase().trim();

    // Check if user exists (exclude deleted accounts)
    const userResult = await db.query(
      "SELECT id, google_id, name, email, active_team FROM users WHERE (google_id = $1 OR LOWER(email) = $2) AND is_deleted = FALSE;",
      [profile.sub, normalizedEmail]
    );

    if (userResult.rowCount) {
      // Existing user - login flow
      const user = userResult.rows[0];

      // If this is a sign-up request but user already exists
      if (isSignUp) {
        return done(null, false, {
          message: `An account with email ${profile.email} already exists. Please sign in instead.`,
          [ERROR_KEY]: "USER_ALREADY_EXISTS"
        });
      }

      // Link Google account if user signed up with email/password but google_id is not set
      if (!user.google_id && profile.sub) {
        try {
          await db.query("UPDATE users SET google_id = $1 WHERE id = $2;", [profile.sub, user.id]);
          user.google_id = profile.sub;
        } catch (error) {
          log_error(error);
        }
      }

      return done(null, user, { message: "User successfully logged in" });
    }

    // New user flow
    if (!isSignUp) {
      // User doesn't exist but trying to sign in
      return done(null, false, {
        message: "No account found with this Google account. Please sign up first.",
        [ERROR_KEY]: "USER_NOT_FOUND"
      });
    }

    // Sign-up flow - validate team_name
    if (!team_name || !team_name.trim()) {
      return done(null, false, {
        message: "Team name is required for registration",
        [ERROR_KEY]: "TEAM_NAME_REQUIRED"
      });
    } else {
      // New user - register
      const googleUserData = {
        id: profile.sub,
        displayName: profile.name,
        email: normalizedEmail,
        picture: profile.picture,
        team_name: team_name.trim(),
        timezone: timezone || "UTC"
      };

      try {
        const registerResult = await db.query(
          "SELECT register_google_user($1) AS user;",
          [JSON.stringify(googleUserData)]
        );
        const { user } = registerResult.rows[0];

        return done(null, user, {
          message: "User successfully registered and logged in",
        });
      } catch (error: any) {
        log_error(error);

        // Handle specific database errors
        if (error.message?.includes("EMAIL_EXISTS_ERROR")) {
          return done(null, false, {
            message: `An account with email ${profile.email} already exists.`,
            [ERROR_KEY]: "EMAIL_EXISTS"
          });
        }

        if (error.message?.includes("TEAM_NAME_EXISTS_ERROR")) {
          const [, teamName] = error.message.split(":");
          return done(null, false, {
            message: `Team name "${teamName}" already exists. Please choose a different team name.`,
            [ERROR_KEY]: "TEAM_NAME_EXISTS"
          });
        }

        // Generic error
        return done(null, false, {
          message: "Registration failed. Please try again.",
          [ERROR_KEY]: "REGISTRATION_FAILED"
        });
      }
    }
  } catch (error: any) {
    log_error(error);
    if (error.response?.status === 400) {
      return done(null, false, { message: "Invalid ID token" });
    }
    return done(error);
  }
}

export default new CustomStrategy(handleMobileGoogleAuth);
