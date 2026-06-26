import GoogleStrategy from "passport-google-oauth20";
import { sendWelcomeEmail } from "../../shared/email-templates";
import { log_error } from "../../shared/utils";
import db from "../../config/db";
import { ERROR_KEY } from "./passport-constants";
import { Request } from "express";

async function handleGoogleLogin(req: Request, _accessToken: string, _refreshToken: string, profile: GoogleStrategy.Profile, done: GoogleStrategy.VerifyCallback) {
  try {
    const body: any = profile;
    if (Array.isArray(profile.emails) && profile.emails.length) body.email = profile.emails[0].value;
    if (Array.isArray(profile.photos) && profile.photos.length) body.picture = profile.photos[0].value;

    // If the user came from an invitation, this exists
    const state = JSON.parse(req.query.state as string || "{}");
    if (state) {
      body.team = state.team;
      body.member_id = state.teamMember;
    }

    const q1 = `SELECT id, google_id, name, email, active_team
                FROM users
                WHERE (google_id = $1 OR email = $2)
                  AND is_deleted = FALSE;`;
    const result1 = await db.query(q1, [body.id, body.email]);

    if (result1.rowCount) { // Login
      const [user] = result1.rows;

      // Link Google account if user signed up with email/password but google_id is not set
      if (!user.google_id && body.id) {
        try {
          await db.query("UPDATE users SET google_id = $1 WHERE id = $2;", [body.id, user.id]);
          user.google_id = body.id;
        } catch (error) {
          log_error(error, user);
        }
      }

      // Update active team of users who came from an invitation
      try {
        await db.query("SELECT set_active_team($1, $2);", [user.id || null, state.team || null]);
      } catch (error) {
        log_error(error, user);
      }

      if (user)
        return done(null, user);

      return done(null, false, { message: "User not found" });
    }

    // Check if a soft-deleted user exists with this email
    const deletedCheck = await db.query(
      "SELECT id, email FROM users WHERE LOWER(email) = LOWER($1) AND is_deleted = TRUE;",
      [body.email]
    );

    if (deletedCheck.rowCount) {
      // Reactivate the soft-deleted account and link Google ID
      const [deletedUser] = deletedCheck.rows;
      await db.query(
        "UPDATE users SET is_deleted = FALSE, google_id = $1, name = COALESCE($2, name) WHERE id = $3;",
        [body.id, body.displayName, deletedUser.id]
      );

      // Update active team if from invitation
      try {
        await db.query("SELECT set_active_team($1, $2);", [deletedUser.id, state.team || null]);
      } catch (error) {
        log_error(error);
      }

      return done(null, { id: deletedUser.id, email: deletedUser.email, google_id: body.id });
    }

    // Register new user
    const q2 = `SELECT register_google_user($1) AS user;`;
    const result2 = await db.query(q2, [JSON.stringify(body)]);
    const [data] = result2.rows;

    sendWelcomeEmail(data.user.email, body.displayName);
    return done(null, data.user, { message: "User successfully logged in" });
  } catch (error: any) {
    console.error("[Google OAuth] handleGoogleLogin CAUGHT ERROR:");
    console.error("[Google OAuth] error:", error);
    console.error("[Google OAuth] message:", error?.message);
    console.error("[Google OAuth] code:", error?.code);
    console.error("[Google OAuth] stack:", error?.stack);
    console.error("[Google OAuth] typeof error:", typeof error);
    console.error("[Google OAuth] JSON:", JSON.stringify(error, Object.getOwnPropertyNames(error || {})));
    log_error(error);
    return done(error);
  }
}

/**
 * Passport strategy for authenticate with google
 * http://www.passportjs.org/packages/passport-google-oauth20/
 */
export default new GoogleStrategy.Strategy({
  clientID: process.env.GOOGLE_CLIENT_ID as string,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  callbackURL: process.env.GOOGLE_CALLBACK_URL as string,
  passReqToCallback: true
},
  (req, _accessToken, _refreshToken, profile, done) => void handleGoogleLogin(req, _accessToken, _refreshToken, profile, done));
