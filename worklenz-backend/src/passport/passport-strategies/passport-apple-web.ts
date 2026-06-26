import { Strategy as AppleStrategy } from "passport-apple";
import { Strategy as CustomStrategy } from "passport-custom";
import { Request } from "express";
import jwt from "jsonwebtoken";
import db from "../../config/db";
import { log_error } from "../../shared/utils";
import { ERROR_KEY } from "./passport-constants";
import { sendWelcomeEmail } from "../../shared/email-templates";

/**
 * Apple ID Token Payload Interface
 */
interface AppleTokenPayload {
  sub: string; // Apple user ID (unique identifier)
  email?: string; // Email
  email_verified?: boolean; // Email verification status
  aud: string; // Audience (client ID)
  iss: string; // Issuer (https://appleid.apple.com)
  exp: number; // Expiration timestamp
  iat: number; // Issued at timestamp
}

/**
 * Apple Web OAuth Handler
 * Handles Apple Sign-In for web applications using OAuth 2.0 flow
 *
 * Flow:
 * 1. User clicks "Sign in with Apple" button
 * 2. Redirected to Apple's authorization page
 * 3. User authorizes and Apple redirects back with authorization code
 * 4. Strategy exchanges code for ID token
 * 5. Verify user and create/login session
 *
 * @param req - Express request object
 * @param accessToken - OAuth access token (not used by Apple)
 * @param refreshToken - OAuth refresh token (not used by Apple)
 * @param idToken - Apple ID token containing user info
 * @param profile - User profile from Apple (often empty on subsequent logins)
 * @param done - Passport callback function
 */
async function handleAppleWebAuth(
  req: Request,
  _accessToken: string,
  _refreshToken: string,
  idToken: any,
  profile: any,
  done: any,
) {
  try {
    // Extract data from ID token (more reliable than profile)
    let appleId: string | undefined;
    let email: string | undefined;
    let name = "Apple User";

    // Try to get data from profile first (first-time login)
    if (profile && profile.id) {
      appleId = profile.id;
      email = profile.email?.toLowerCase().trim();
      if (profile.name) {
        name =
          `${profile.name.firstName || ""} ${
            profile.name.lastName || ""
          }`.trim() || "Apple User";
      }
    }

    // Apple sends user data in req.body.user on first authorization
    // This is a JSON string containing { name: { firstName, lastName }, email }

    if (req.body && req.body.user) {
      try {
        const userData =
          typeof req.body.user === "string"
            ? JSON.parse(req.body.user)
            : req.body.user;

        if (userData.name) {
          const firstName = userData.name.firstName || "";
          const lastName = userData.name.lastName || "";
          name = `${firstName} ${lastName}`.trim() || "Apple User";
        }

        // Also get email from body if available
        if (userData.email && !email) {
          email = userData.email.toLowerCase().trim();
        }
      } catch (error) {
        log_error("Failed to parse Apple user data from request body:", error);
      }
    }

    // If profile is empty or missing data, decode ID token
    // Apple only sends profile data on first authorization, so we extract from token on subsequent logins
    if ((!appleId || !email) && idToken) {
      try {
        // Decode ID token without verification (passport-apple already verified it)
        const tokenPayload = jwt.decode(idToken) as AppleTokenPayload;

        if (tokenPayload) {
          appleId = appleId || tokenPayload.sub;
          email = email || tokenPayload.email?.toLowerCase().trim();
        }
      } catch (error) {
        log_error("Failed to decode Apple ID token:", error);
      }
    }

    // Validate Apple ID
    if (!appleId) {
      return done(null, false, { message: "Apple ID not found" });
    }

    // Check for existing local account (password-based)
    if (email) {
      const localAccountResult = await db.query(
        "SELECT 1 FROM users WHERE LOWER(email) = $1 AND password IS NOT NULL AND is_deleted IS FALSE;",
        [email],
      );

      if (localAccountResult.rowCount) {
        const message = `An account with email ${email} already exists. Please sign in with your password.`;
        (req.session as any).error = message;
        return done(null, undefined, {
          message: req.flash(ERROR_KEY, message),
        });
      }
    }

    // Handle invitation state (team/project invitations)
    const state = JSON.parse((req.query.state as string) || "{}");
    const body: any = {
      id: appleId,
      displayName: name,
      email: email,
      team: state.team,
      member_id: state.teamMember,
    };

    // Look up user by apple_id (primary) or email (secondary) - exclude deleted accounts
    let userResult;
    if (email) {
      userResult = await db.query(
        "SELECT id, apple_id, google_id, name, email, active_team FROM users WHERE (apple_id = $1 OR LOWER(email) = $2) AND is_deleted = FALSE;",
        [appleId, email],
      );
    } else {
      userResult = await db.query(
        "SELECT id, apple_id, google_id, name, email, active_team FROM users WHERE apple_id = $1 AND is_deleted = FALSE;",
        [appleId],
      );
    }

    // Existing user - login flow
    if (userResult.rowCount) {
      const user = userResult.rows[0];

      // Check for Google account conflict
      if (user.google_id !== null && user.apple_id === null) {
        const message =
          "This account is linked to Google. Please sign in with Google.";
        (req.session as any).error = message;
        return done(null, undefined, {
          message: req.flash(ERROR_KEY, message),
        });
      }

      // Update apple_id if not set (email-first signup scenario)
      if (!user.apple_id) {
        await db.query("UPDATE users SET apple_id = $1 WHERE id = $2;", [
          appleId,
          user.id,
        ]);
        user.apple_id = appleId;
      }

      // Update active team if coming from invitation
      if (state.team) {
        try {
          await db.query("SELECT set_active_team($1, $2);", [
            user.id,
            state.team,
          ]);
        } catch (error) {
          log_error(error, user);
        }
      }

      return done(null, user, { message: "User successfully logged in" });
    }

    // New user - registration flow
    // Email is required for new user registration
    if (!email) {
      const message =
        "Email is required for registration. Please sign in with Apple again and provide your email.";
      (req.session as any).error = message;
      return done(null, undefined, { message: req.flash(ERROR_KEY, message) });
    }

    // Register new user via database function
    const registerResult = await db.query(
      "SELECT register_apple_user($1) AS user;",
      [JSON.stringify(body)],
    );

    const { user } = registerResult.rows[0];

    // Send welcome email
    sendWelcomeEmail(email, name);

    return done(null, user, {
      message: "User successfully registered and logged in",
    });
  } catch (error: any) {
    log_error("Apple web authentication error:", error);
    return done(error);
  }
}

/**
 * Passport strategy for Apple Sign-In (Web OAuth)
 * Uses passport-apple package for OAuth 2.0 flow
 * @see https://developer.apple.com/documentation/sign_in_with_apple
 *
 * This strategy is conditionally exported based on environment configuration
 */

// Check if Apple Sign-In is properly configured
const isAppleConfigured = () => {
  return !!(
    process.env.APPLE_CLIENT_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_KEY_ID &&
    process.env.APPLE_PRIVATE_KEY_PATH &&
    process.env.APPLE_CALLBACK_URL
  );
};

// Only create strategy if Apple is configured
let appleStrategy: any = null;

if (isAppleConfigured()) {
  appleStrategy = new AppleStrategy(
    {
      clientID: process.env.APPLE_CLIENT_ID as string,
      teamID: process.env.APPLE_TEAM_ID as string,
      keyID: process.env.APPLE_KEY_ID as string,
      privateKeyLocation: process.env.APPLE_PRIVATE_KEY_PATH as string,
      callbackURL: process.env.APPLE_CALLBACK_URL as string,
      passReqToCallback: true,
      scope: ["name", "email"],
    },
    (
      req: any,
      accessToken: any,
      refreshToken: any,
      idToken: any,
      profile: any,
      done: any,
    ) =>
      void handleAppleWebAuth(
        req,
        accessToken,
        refreshToken,
        idToken,
        profile,
        done,
      ),
  );
} else {
  console.warn(
    "⚠️  Apple Sign-In Web OAuth is not configured. Set APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY_PATH, and APPLE_CALLBACK_URL in .env to enable it.",
  );
}

export default appleStrategy;
