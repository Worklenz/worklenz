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
    const { idToken } = req.body;

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

    // Check if user exists
    const userResult = await db.query(
      "SELECT id, google_id, name, email, active_team FROM users WHERE google_id = $1 OR email = $2;",
      [profile.sub, profile.email]
    );

    if (userResult.rowCount) {
      // Existing user - login
      const user = userResult.rows[0];

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

    // New user - registration not allowed from mobile
    return done(null, false, {
      message: "Please create your account using the web application first, then you can sign in with Google on mobile.",
      [ERROR_KEY]: "MOBILE_REGISTRATION_DISABLED"
    });
    // // New user - register
    // const googleUserData = {
    //   id: profile.sub,
    //   displayName: profile.name,
    //   email: profile.email,
    //   picture: profile.picture,
    // };

    // const registerResult = await db.query(
    //   "SELECT register_google_user($1) AS user;",
    //   [JSON.stringify(googleUserData)]
    // );
    // const { user } = registerResult.rows[0];

    // return done(null, user, {
    //   message: "User successfully registered and logged in",
    // });
  } catch (error: any) {
    log_error(error);
    if (error.response?.status === 400) {
      return done(null, false, { message: "Invalid ID token" });
    }
    return done(error);
  }
}

export default new CustomStrategy(handleMobileGoogleAuth);
