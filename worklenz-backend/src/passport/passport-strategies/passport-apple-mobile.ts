import { Strategy as CustomStrategy } from "passport-custom";
import { Request } from "express";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import db from "../../config/db";
import { log_error } from "../../shared/utils";
import { ERROR_KEY } from "./passport-constants";

/**
 * Apple ID Token Payload Interface
 * Based on Apple's JWT token structure
 * @see https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api/authenticating_users_with_sign_in_with_apple
 */
interface AppleTokenPayload {
  sub: string;              // Apple user ID (unique identifier)
  email?: string;           // Email (only provided on first sign-in)
  email_verified?: boolean; // Email verification status
  aud: string;              // Audience (client ID / bundle ID)
  iss: string;              // Issuer (https://appleid.apple.com)
  exp: number;              // Expiration timestamp
  iat: number;              // Issued at timestamp
  nonce?: string;           // Nonce for replay attack prevention
  nonce_supported?: boolean;
}

/**
 * JWKS Client for fetching Apple's public keys
 * Keys are cached for 24 hours to improve performance
 * @see https://appleid.apple.com/auth/keys
 */
const client = jwksClient({
  jwksUri: "https://appleid.apple.com/auth/keys",
  cache: true,
  cacheMaxAge: 86400000, // 24 hours in milliseconds
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

/**
 * Get Apple's signing key for token verification
 * @param kid - Key ID from token header
 * @returns Public key for verification
 */
async function getAppleSigningKey(kid: string): Promise<string> {
  try {
    const key = await client.getSigningKey(kid);
    return key.getPublicKey();
  } catch (error) {
    log_error("Failed to fetch Apple signing key:", error);
    throw new Error("Unable to verify Apple ID token");
  }
}

/**
 * Apple Mobile Authentication Handler
 * Verifies Apple ID token and authenticates/registers user
 * 
 * Flow:
 * 1. Validate ID token presence
 * 2. Decode token header to get key ID
 * 3. Fetch Apple's public signing key
 * 4. Verify token signature and claims
 * 5. Check for existing user or register new user
 * 6. Return user object for session creation
 * 
 * @param req - Express request object
 * @param done - Passport callback function
 */
async function handleAppleMobileAuth(req: Request, done: any) {
  try {
    const { idToken, isSignUp, team_name, timezone } = req.body;

    // Validate ID token presence
    if (!idToken) {
      return done(null, false, { message: "Apple ID token is required" });
    }

    // Decode token header to get key ID (kid)
    const decoded = jwt.decode(idToken, { complete: true });

    if (!decoded || !decoded.header.kid) {
      return done(null, false, { message: "Invalid Apple ID token format" });
    }

    // Fetch Apple's public signing key
    const signingKey = await getAppleSigningKey(decoded.header.kid);

    // Prepare allowed client IDs (bundle IDs)
    const allowedClientIds = [
      process.env.APPLE_CLIENT_ID,
      process.env.APPLE_IOS_CLIENT_ID,
      process.env.APPLE_ANDROID_CLIENT_ID,
    ].filter((id): id is string => Boolean(id));

    if (allowedClientIds.length === 0) {
      log_error("No Apple client IDs configured in environment variables");
      return done(null, false, {
        message: "Apple Sign-In is not properly configured"
      });
    }

    // Verify token signature and claims (without audience check in jwt.verify)
    const payload = jwt.verify(idToken, signingKey, {
      algorithms: ["RS256"],
      issuer: "https://appleid.apple.com"
    }) as AppleTokenPayload;

    // Manually verify audience (client ID)
    if (!allowedClientIds.includes(payload.aud)) {
      return done(null, false, {
        message: "Invalid token audience (client ID)"
      });
    }

    // Extract user data
    const appleId = payload.sub;
    const email = payload.email?.toLowerCase().trim();
    const emailVerified = payload.email_verified ?? true;

    // Validate Apple ID
    if (!appleId) {
      return done(null, false, { message: "Apple ID (sub) not found in token" });
    }

    // Check for existing local account (password-based)
    if (email) {
      const localAccountResult = await db.query(
        "SELECT 1 FROM users WHERE LOWER(email) = $1 AND password IS NOT NULL AND is_deleted IS FALSE;",
        [email]
      );

      if (localAccountResult.rowCount) {
        return done(null, false, {
          message: `An account with email ${email} already exists. Please sign in with your password.`
        });
      }
    }

    // Look up user by apple_id (primary) or email (secondary) - exclude deleted accounts
    let userResult;
    if (email) {
      userResult = await db.query(
        "SELECT id, apple_id, google_id, name, email, active_team FROM users WHERE (apple_id = $1 OR LOWER(email) = $2) AND is_deleted = FALSE;",
        [appleId, email]
      );
    } else {
      userResult = await db.query(
        "SELECT id, apple_id, google_id, name, email, active_team FROM users WHERE apple_id = $1 AND is_deleted = FALSE;",
        [appleId]
      );
    }

    // Existing user - login flow
    if (userResult.rowCount) {
      const user = userResult.rows[0];

      // If this is a sign-up request but user already exists
      if (isSignUp) {
        return done(null, false, {
          message: email
            ? `An account with email ${email} already exists. Please sign in instead.`
            : "An account with this Apple ID already exists. Please sign in instead.",
          [ERROR_KEY]: "USER_ALREADY_EXISTS"
        });
      }

      // Check for Google account conflict
      if (user.google_id !== null && user.apple_id === null) {
        return done(null, false, {
          message: "This account is linked to Google. Please sign in with Google."
        });
      }

      // Update apple_id if not set (email-first signup scenario)
      if (!user.apple_id) {
        await db.query(
          "UPDATE users SET apple_id = $1 WHERE id = $2;",
          [appleId, user.id]
        );
        user.apple_id = appleId;
      }

      // Update email if provided and different (first sign-in scenario)
      if (email && user.email !== email && emailVerified) {
        await db.query(
          "UPDATE users SET email = $1 WHERE id = $2;",
          [email, user.id]
        );
        user.email = email;
      }

      // Update last active timestamp
      await db.query(
        "UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = $1;",
        [user.id]
      );

      return done(null, user, { message: "User successfully logged in" });
    }

    // New user flow
    if (!isSignUp) {
      // User doesn't exist but trying to sign in
      return done(null, false, {
        message: "No account found with this Apple ID. Please sign up first.",
        [ERROR_KEY]: "USER_NOT_FOUND"
      });
    }

    // Sign-up flow - validate required fields
    if (!email) {
      return done(null, false, {
        message: "Email is required for registration. Please sign in with Apple again and provide your email.",
        [ERROR_KEY]: "EMAIL_REQUIRED"
      });
    }

    if (!team_name || !team_name.trim()) {
      return done(null, false, {
        message: "Team name is required for registration",
        [ERROR_KEY]: "TEAM_NAME_REQUIRED"
      });
    }

    // Prepare user data for registration
    const appleUserData = {
      id: appleId,
      displayName: "Apple User", // Apple doesn't provide name on subsequent logins
      email: email,
      team_name: team_name.trim(),
      timezone: timezone || "UTC"
    };

    try {
      // Register new user via database function
      const registerResult = await db.query(
        "SELECT register_apple_user($1) AS user;",
        [JSON.stringify(appleUserData)]
      );

      const { user } = registerResult.rows[0];

      return done(null, user, {
        message: "User successfully registered and logged in"
      });
    } catch (error: any) {
      log_error("Apple user registration error:", error);

      // Handle specific database errors
      if (error.message?.includes("EMAIL_EXISTS_ERROR")) {
        return done(null, false, {
          message: `An account with email ${email} already exists.`,
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

  } catch (error: any) {
    log_error("Apple mobile authentication error:", error);

    // Handle specific JWT errors
    if (error.name === "TokenExpiredError") {
      return done(null, false, { message: "Apple ID token has expired" });
    }
    if (error.name === "JsonWebTokenError") {
      return done(null, false, { message: "Invalid Apple ID token" });
    }
    if (error.name === "NotBeforeError") {
      return done(null, false, { message: "Apple ID token not yet valid" });
    }

    // Generic error
    return done(error);
  }
}

// Export the custom strategy
export default new CustomStrategy(handleAppleMobileAuth);
