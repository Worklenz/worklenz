import GoogleStrategy from "passport-google-oauth20";
import {sendWelcomeEmail} from "../../shared/email-templates";
import {log_error} from "../../shared/utils";
import db from "../../config/db";
import {ERROR_KEY} from "./passport-constants";
import {Request} from "express";

async function handleGoogleLogin(req: Request, _accessToken: string, _refreshToken: string, profile: GoogleStrategy.Profile, done: GoogleStrategy.VerifyCallback) {
  try {
    const body: any = profile;
    if (Array.isArray(profile.emails) && profile.emails.length) body.email = profile.emails[0].value;
    if (Array.isArray(profile.photos) && profile.photos.length) body.picture = profile.photos[0].value;

    // Check for existing accounts signed up using OAuth
    const localAccountResult = await db.query("SELECT 1 FROM users WHERE email = $1 AND password IS NOT NULL;", [body.email]);
    if (localAccountResult.rowCount) {
      const message = `No Google account exists for email ${body.email}.`;
      (req.session as any).error = message;
      return done(null, undefined, req.flash(ERROR_KEY, message));
    }

    // If the user came from an invitation, this exists
    const state = JSON.parse(req.query.state as string || "{}");
    if (state) {
      body.team = state.team;
      body.member_id = state.teamMember;
    }

    const q1 = `SELECT id, google_id, name, email, active_team
                FROM users
                WHERE google_id = $1
                   OR email = $2;`;
    const result1 = await db.query(q1, [body.id, body.email]);

    if (result1.rowCount) { // Login
      const [user] = result1.rows;

      // Update active team of users who came from an invitation
      try {
        await db.query("SELECT set_active_team($1, $2);", [user.id || null, state.team || null]);
      } catch (error) {
        log_error(error, user);
      }

      if (user)
        return done(null, user);

    } else { // Register
      const q2 = `SELECT register_google_user($1) AS user;`;
      const result2 = await db.query(q2, [JSON.stringify(body)]);
      const [data] = result2.rows;

      sendWelcomeEmail(data.user.email, body.displayName);
      return done(null, data.user, {message: "User successfully logged in"});
    }

    return done(null);
  } catch (error: any) {
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
