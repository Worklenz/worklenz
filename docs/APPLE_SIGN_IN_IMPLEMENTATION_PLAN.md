# Apple Sign-In (iCloud SSO) Implementation Plan for Worklenz Backend

## Executive Summary

This document provides a comprehensive, production-ready implementation plan for Apple Sign-In (iCloud Single Sign-On) for the Worklenz mobile application. The implementation follows the same architecture pattern as the existing Google OAuth mobile authentication while adhering to Apple's specific requirements and best practices.

---

## 1. Current Architecture Analysis

### 1.1 Existing Authentication System

**Worklenz Backend** uses a **session-based authentication** system with the following components:

- **Passport.js** for authentication strategies
- **PostgreSQL** for user data storage with `pg-sessions` for session management
- **Express-session** with Redis/PostgreSQL session store
- **Multiple authentication methods**:
  - Local (email/password)
  - Google OAuth (web-based)
  - Google OAuth (mobile token-based)

### 1.2 Database Schema

**Users Table** (`worklenz-backend/database/sql/1_tables.sql`):
```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    email           WL_EMAIL NOT NULL,
    password        TEXT,
    active_team     UUID,
    avatar_url      TEXT,
    setup_completed BOOLEAN DEFAULT FALSE,
    user_no         BIGINT,
    timezone_id     UUID NOT NULL,
    google_id       TEXT,              -- OAuth identifier
    socket_id       TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    temp_email      BOOLEAN DEFAULT FALSE,
    is_deleted      BOOLEAN DEFAULT FALSE,
    deleted_at      TIMESTAMP WITH TIME ZONE,
    language        LANGUAGE_TYPE DEFAULT 'en'
);
```


### 1.3 Current Google Mobile Authentication Flow

**File**: `worklenz-backend/src/passport/passport-strategies/passport-google-mobile.ts`

1. Mobile app obtains ID token from Google
2. Mobile app sends token to `/auth/google/mobile` endpoint
3. Backend verifies token with Google's tokeninfo endpoint
4. Backend checks for existing user by `google_id` or `email`
5. If new user: calls `register_google_user()` database function
6. If existing user: logs in and updates session
7. Returns session-based authentication with user data

**Key Characteristics**:
- Uses `passport-custom` strategy
- Session-based authentication (not JWT)
- Validates token audience (client ID), issuer, and expiration
- Prevents conflicts with local password accounts
- Stores `google_id` as OAuth identifier

---

## 2. Apple Sign-In Architecture Design

### 2.1 Key Differences from Google OAuth

| Aspect | Google OAuth | Apple Sign-In |
|--------|-------------|---------------|
| **Token Verification** | Simple HTTP GET to tokeninfo endpoint | JWT verification with Apple's JWKS public keys |
| **Email Availability** | Always provided | Only on first sign-in (privacy feature) |
| **User Identifier** | `sub` claim (always available) | `sub` claim (always available) |
| **Private Email** | Not supported | Supports private relay emails |
| **Required Libraries** | axios | jsonwebtoken, jwks-rsa |

### 2.2 Implementation Strategy

Following the reference implementation from `docs/APPLE_SIGN_IN_IMPLEMENTATION.md`, we will:

1. **Add `apple_id` column** to users table
2. **Create Apple mobile Passport strategy** using JWT verification
3. **Add API endpoint** `/auth/apple/mobile`
4. **Create database function** `register_apple_user()`
5. **Handle Apple's privacy features** (email availability, private relay)
6. **Prevent account conflicts** (existing Google/password accounts)

---

## 3. Detailed Implementation Plan

### Phase 1: Database Schema Changes

#### Step 1.1: Create Migration File

**File**: `worklenz-backend/database/migrations/20251112000001-add-apple-sign-in-support.sql`


```sql
-- Migration: Add Apple Sign-In support to Worklenz
-- Date: 2025-11-12
-- Description: Adds apple_id column to users table for Apple OAuth authentication

-- Add apple_id column to users table
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS apple_id TEXT;

-- Create index for apple_id lookups (performance optimization)
CREATE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id);

-- Add comment for documentation
COMMENT ON COLUMN users.apple_id IS 'Apple unique user identifier (sub claim from Apple ID token)';

-- Verify the column was added
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'apple_id'
    ) THEN
        RAISE NOTICE 'apple_id column successfully added to users table';
    ELSE
        RAISE EXCEPTION 'Failed to add apple_id column to users table';
    END IF;
END $$;
```

**Rollback Script** (if needed):
```sql
-- Rollback: Remove Apple Sign-In support
DROP INDEX IF EXISTS idx_users_apple_id;
ALTER TABLE users DROP COLUMN IF EXISTS apple_id;
```

#### Step 1.2: Create Database Function for Apple User Registration

**File**: Add to `worklenz-backend/database/sql/4_functions.sql` or create separate migration


```sql
-- Function: register_apple_user
-- Description: Registers a new user via Apple Sign-In
-- Similar to register_google_user but handles Apple-specific fields

CREATE OR REPLACE FUNCTION register_apple_user(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _user_id         UUID;
    _organization_id UUID;
    _team_id         UUID;
    _role_id         UUID;
    _name            TEXT;
    _email           TEXT;
    _apple_id        TEXT;
BEGIN
    -- Extract data from JSON body
    _name = COALESCE((_body ->> 'displayName')::TEXT, 'Apple User');
    _email = (_body ->> 'email')::TEXT;
    _apple_id = (_body ->> 'id')::TEXT;

    -- Validate required fields
    IF _apple_id IS NULL THEN
        RAISE EXCEPTION 'Apple ID (sub) is required';
    END IF;

    -- Insert new user
    INSERT INTO users (name, email, apple_id, timezone_id)
    VALUES (_name, _email, _apple_id, 
            COALESCE((SELECT id FROM timezones WHERE name = (_body ->> 'timezone')),
                     (SELECT id FROM timezones WHERE name = 'UTC')))
    RETURNING id INTO _user_id;

    -- Insert organization data
    INSERT INTO organizations (
        user_id, 
        organization_name, 
        contact_number, 
        contact_number_secondary, 
        trial_in_progress,
        trial_expire_date, 
        subscription_status, 
        license_type_id
    )
    VALUES (
        _user_id, 
        COALESCE(TRIM((_body ->> 'team_name')::TEXT), _name), 
        NULL, 
        NULL, 
        TRUE, 
        CURRENT_DATE + INTERVAL '9999 days',
        'active', 
        (SELECT id FROM sys_license_types WHERE key = 'SELF_HOSTED')
    )
    RETURNING id INTO _organization_id;

    -- Insert default team
    INSERT INTO teams (name, user_id, organization_id)
    VALUES (_name, _user_id, _organization_id)
    RETURNING id INTO _team_id;

    -- Insert default roles
    INSERT INTO roles (name, team_id, default_role) VALUES ('Member', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Admin', _team_id, TRUE);
    INSERT INTO roles (name, team_id, admin_role) VALUES ('Team Lead', _team_id, TRUE);
    INSERT INTO roles (name, team_id, owner) VALUES ('Owner', _team_id, TRUE) 
    RETURNING id INTO _role_id;

    -- Add user to team
    INSERT INTO team_members (user_id, team_id, role_id)
    VALUES (_user_id, _team_id, _role_id);

    -- Handle team invitations (if applicable)
    IF (is_null_or_empty(_body ->> 'team') OR is_null_or_empty(_body ->> 'member_id'))
    THEN
        UPDATE users SET active_team = _team_id WHERE id = _user_id;
    ELSE
        -- Verify team member invitation
        IF EXISTS(
            SELECT id
            FROM team_members
            WHERE id = (_body ->> 'member_id')::UUID
              AND team_id = (_body ->> 'team')::UUID
        )
        THEN
            UPDATE team_members
            SET user_id = _user_id
            WHERE id = (_body ->> 'member_id')::UUID
              AND team_id = (_body ->> 'team')::UUID;

            DELETE FROM email_invitations
            WHERE team_id = (_body ->> 'team')::UUID
              AND team_member_id = (_body ->> 'member_id')::UUID;

            UPDATE users SET active_team = (_body ->> 'team')::UUID WHERE id = _user_id;
        END IF;
    END IF;

    -- Return user data
    RETURN JSON_BUILD_OBJECT(
        'id', _user_id,
        'email', _email,
        'apple_id', _apple_id,
        'name', _name
    );
END
$$;

-- Add comment for documentation
COMMENT ON FUNCTION register_apple_user(json) IS 'Registers a new user via Apple Sign-In OAuth';
```

#### Step 1.3: Update deserialize_user Function

Update the `deserialize_user` function to include `apple_id` in the session data:


```sql
-- Update deserialize_user to include apple_id
-- Add this to the existing function's SELECT statement:
-- (is_null_or_empty(u.apple_id) IS FALSE) AS is_apple,

-- Example modification (add to existing deserialize_user function):
SELECT 
    -- ... existing fields ...
    (is_null_or_empty(u.google_id) IS FALSE) AS is_google,
    (is_null_or_empty(u.apple_id) IS FALSE) AS is_apple,  -- NEW LINE
    -- ... rest of fields ...
FROM users u
WHERE u.id = _user_id;
```

---

### Phase 2: Install Required Dependencies

#### Step 2.1: Add NPM Packages

**File**: `worklenz-backend/package.json`

Add the following dependencies:

```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.2",
    "jwks-rsa": "^3.2.0"
  }
}
```

**Installation Command**:
```bash
cd worklenz-backend
npm install jsonwebtoken@^9.0.2 jwks-rsa@^3.2.0
```

**Note**: These packages are required for:
- `jsonwebtoken`: Verifying Apple's JWT ID tokens
- `jwks-rsa`: Fetching and caching Apple's public signing keys from JWKS endpoint

---

### Phase 3: Environment Configuration

#### Step 3.1: Update .env File

**File**: `worklenz-backend/.env`

Add the following Apple Sign-In configuration:


```bash
# Apple Sign-In Configuration
# Service ID (for web-based OAuth - optional for mobile-only)
APPLE_CLIENT_ID=com.worklenz.service

# iOS Bundle ID (primary mobile app identifier)
APPLE_IOS_CLIENT_ID=com.worklenz.mobile

# Android Package Name (if supporting Android)
APPLE_ANDROID_CLIENT_ID=com.worklenz.mobile.android
```

**Configuration Notes**:
- `APPLE_CLIENT_ID`: Apple Service ID (used for web OAuth, optional for mobile-only)
- `APPLE_IOS_CLIENT_ID`: iOS app Bundle ID (must match Xcode project)
- `APPLE_ANDROID_CLIENT_ID`: Android package name (optional, for future Android support)

**Apple Developer Setup Required**:
1. Create App ID in Apple Developer Portal
2. Enable "Sign in with Apple" capability
3. Create Service ID (if using web OAuth)
4. Configure Bundle IDs for iOS app

---

### Phase 4: Passport Strategy Implementation

#### Step 4.1: Create Apple Mobile Passport Strategy

**File**: `worklenz-backend/src/passport/passport-strategies/passport-apple-mobile.ts`


```typescript
import { Strategy as CustomStrategy } from "passport-custom";
import { Request } from "express";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import db from "../../config/db";
import { log_error } from "../../shared/utils";

/**
 * Apple ID Token Payload Interface
 * Based on Apple's JWT token structure
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
 */
async function handleAppleMobileAuth(req: Request, done: any) {
  try {
    const { idToken } = req.body;

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
    ].filter(Boolean);

    if (allowedClientIds.length === 0) {
      log_error("No Apple client IDs configured in environment variables");
      return done(null, false, { 
        message: "Apple Sign-In is not properly configured" 
      });
    }

    // Verify token signature and claims
    const payload = jwt.verify(idToken, signingKey, {
      algorithms: ["RS256"],
      issuer: "https://appleid.apple.com",
      audience: allowedClientIds
    }) as AppleTokenPayload;

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

    // Look up user by apple_id (primary) or email (secondary)
    let userResult;
    if (email) {
      userResult = await db.query(
        "SELECT id, apple_id, google_id, name, email, active_team FROM users WHERE apple_id = $1 OR LOWER(email) = $2;",
        [appleId, email]
      );
    } else {
      userResult = await db.query(
        "SELECT id, apple_id, google_id, name, email, active_team FROM users WHERE apple_id = $1;",
        [appleId]
      );
    }

    // Existing user - login flow
    if (userResult.rowCount) {
      const user = userResult.rows[0];

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

    // New user - registration flow
    // Email is required for new user registration
    if (!email) {
      return done(null, false, {
        message: "Email is required for new user registration. Please sign in with Apple again and provide your email."
      });
    }

    // Prepare user data for registration
    const appleUserData = {
      id: appleId,
      displayName: "Apple User", // Apple doesn't provide name on subsequent logins
      email: email,
      timezone: req.body.timezone || "UTC"
    };

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
```

**Key Features of This Implementation**:
1. ✅ JWT verification with Apple's public keys (JWKS)
2. ✅ Token signature validation using RS256 algorithm
3. ✅ Issuer and audience validation
4. ✅ Handles Apple's privacy features (email may be missing)
5. ✅ Prevents conflicts with existing Google/password accounts
6. ✅ Updates `apple_id` for existing users (email-first scenario)
7. ✅ Requires email for new user registration
8. ✅ Comprehensive error handling with specific error messages
9. ✅ Key caching for performance (24-hour cache)

---

### Phase 5: Register Passport Strategy

#### Step 5.1: Update Passport Configuration

**File**: `worklenz-backend/src/passport/index.ts`


```typescript
import {PassportStatic} from "passport";

import {deserialize} from "./deserialize";
import {serialize} from "./serialize";

import GoogleLogin from "./passport-strategies/passport-google";
import GoogleMobileLogin from "./passport-strategies/passport-google-mobile";
import AppleMobileLogin from "./passport-strategies/passport-apple-mobile"; // NEW IMPORT
import LocalLogin from "./passport-strategies/passport-local-login";
import LocalSignup from "./passport-strategies/passport-local-signup";

/**
 * Use any passport middleware before the serialize and deserialize
 * @param {Passport} passport
 */
export default (passport: PassportStatic) => {
  passport.use("local-login", LocalLogin);
  passport.use("local-signup", LocalSignup);
  passport.use(GoogleLogin);
  passport.use("google-mobile", GoogleMobileLogin);
  passport.use("apple-mobile", AppleMobileLogin); // NEW STRATEGY
  passport.serializeUser(serialize);
  passport.deserializeUser(deserialize);
};
```

---

### Phase 6: API Route Implementation

#### Step 6.1: Add Apple Mobile Authentication Route

**File**: `worklenz-backend/src/routes/auth/index.ts`


```typescript
// Add this after the Google mobile authentication route

// Apple Mobile Sign-In using Passport strategy
authRouter.post("/apple/mobile", AuthController.appleMobileAuthPassport);
```

**Complete route section should look like**:
```typescript
// Mobile Google Sign-In using Passport strategy
authRouter.post("/google/mobile", AuthController.googleMobileAuthPassport);

// Mobile Apple Sign-In using Passport strategy
authRouter.post("/apple/mobile", AuthController.appleMobileAuthPassport);
```

---

### Phase 7: Controller Implementation

#### Step 7.1: Add Apple Authentication Controller Method

**File**: `worklenz-backend/src/controllers/auth-controller.ts`


```typescript
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
        body: null
      });
    }

    // Handle authentication failure (invalid token, user not found, etc.)
    if (!user) {
      return res.status(400).send({
        done: false,
        message: info?.message || "Apple authentication failed",
        body: null
      });
    }

    // Log the user in (create session)
    req.login(user, (loginErr) => {
      if (loginErr) {
        log_error("Apple login session creation error:", loginErr);
        return res.status(500).send({
          done: false,
          message: "Session creation failed",
          body: null
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
            body: null
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
```

**Add this method to the `AuthController` class**, right after the `googleMobileAuthPassport` method.

---

### Phase 8: Update Password Reset Logic

#### Step 8.1: Prevent Password Reset for Apple Users

**File**: `worklenz-backend/src/controllers/auth-controller.ts`

Update the `reset_password` method to check for Apple accounts:


```typescript
@HandleExceptions({logWithError: "body"})
public static async reset_password(req: IWorkLenzRequest, res: IWorkLenzResponse) {
  const {email} = req.body;

  // Normalize email to lowercase for case-insensitive comparison
  const normalizedEmail = email ? email.toLowerCase().trim() : null;

  // Update query to include apple_id
  const q = `SELECT id, email, google_id, apple_id, password FROM users WHERE LOWER(email) = $1;`;
  const result = await db.query(q, [normalizedEmail]);

  if (!result.rowCount)
    return res.status(200).send(new ServerResponse(false, null, "Account does not exists!"));

  const [data] = result.rows;

  // Check for Google account
  if (data?.google_id) {
    return res.status(200).send(new ServerResponse(false, "oauth_user", "This account uses Google Sign-In. Please sign in with Google instead."));
  }

  // Check for Apple account (NEW)
  if (data?.apple_id) {
    return res.status(200).send(new ServerResponse(false, "oauth_user", "This account uses Apple Sign-In. Please sign in with Apple instead."));
  }

  // Rest of the existing password reset logic...
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
```

---

## 4. Testing Strategy

### 4.1 Unit Testing

Create test file: `worklenz-backend/src/tests/auth/apple-mobile-auth.test.ts`


```typescript
import request from 'supertest';
import app from '../../app';

describe('Apple Mobile Authentication', () => {
  describe('POST /auth/apple/mobile', () => {
    it('should reject request without ID token', async () => {
      const response = await request(app)
        .post('/auth/apple/mobile')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.done).toBe(false);
    });

    it('should reject invalid ID token', async () => {
      const response = await request(app)
        .post('/auth/apple/mobile')
        .send({ idToken: 'invalid_token' });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid');
    });

    it('should reject expired ID token', async () => {
      // Use an expired token for testing
      const expiredToken = 'expired_jwt_token_here';
      
      const response = await request(app)
        .post('/auth/apple/mobile')
        .send({ idToken: expiredToken });
      
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('expired');
    });

    // Add more tests for:
    // - Successful new user registration
    // - Successful existing user login
    // - Account conflict scenarios
    // - Email privacy scenarios
  });
});
```

### 4.2 Integration Testing

**Test Scenarios**:

1. **New User Registration**
   - Valid Apple ID token with email
   - User created in database
   - Session established
   - Organization and team created

2. **Existing User Login**
   - Valid Apple ID token
   - User found by `apple_id`
   - Session established
   - Last active timestamp updated

3. **Email Privacy Handling**
   - First sign-in: email provided
   - Subsequent sign-ins: email may be missing
   - User lookup by `apple_id` works without email

4. **Account Conflict Prevention**
   - Existing password account: rejected
   - Existing Google account: rejected
   - Email-first signup: `apple_id` updated

5. **Token Validation**
   - Invalid signature: rejected
   - Wrong issuer: rejected
   - Wrong audience: rejected
   - Expired token: rejected

### 4.3 Manual Testing Checklist

- [ ] Install dependencies (`jsonwebtoken`, `jwks-rsa`)
- [ ] Run database migration
- [ ] Configure environment variables
- [ ] Test with iOS Simulator
- [ ] Test with physical iOS device
- [ ] Test new user registration
- [ ] Test existing user login
- [ ] Test account conflict scenarios
- [ ] Test email privacy (subsequent logins)
- [ ] Test private relay email
- [ ] Test session persistence
- [ ] Test logout functionality
- [ ] Test password reset prevention

---

## 5. Security Considerations

### 5.1 Token Verification

✅ **JWT Signature Verification**: Uses Apple's public keys via JWKS
✅ **Issuer Validation**: Ensures token is from `https://appleid.apple.com`
✅ **Audience Validation**: Verifies client ID matches configured bundle IDs
✅ **Expiration Check**: Validates token hasn't expired
✅ **Algorithm Validation**: Only accepts RS256 algorithm

### 5.2 Account Security

✅ **Conflict Prevention**: Prevents linking to existing Google/password accounts
✅ **Email Verification**: Apple tokens include email verification status
✅ **Session Security**: Uses secure session cookies with HttpOnly flag
✅ **Rate Limiting**: Inherits from global API rate limiting

### 5.3 Privacy Features

✅ **Email Privacy**: Handles Apple's private relay emails
✅ **Email Availability**: Works when email is not provided (subsequent logins)
✅ **Data Minimization**: Only stores necessary user data

### 5.4 Best Practices

✅ **Key Caching**: Apple's public keys cached for 24 hours
✅ **Error Handling**: Comprehensive error messages without exposing sensitive data
✅ **Logging**: Errors logged for debugging without exposing tokens
✅ **Database Transactions**: Not needed for single-user operations (consider for complex flows)

---

## 6. Mobile App Integration Guide

### 6.1 iOS Implementation (Swift)


```swift
import AuthenticationServices

class AppleSignInManager: NSObject {
    
    // MARK: - Trigger Apple Sign In
    func signInWithApple() {
        let appleIDProvider = ASAuthorizationAppleIDProvider()
        let request = appleIDProvider.createRequest()
        request.requestedScopes = [.fullName, .email]
        
        let authorizationController = ASAuthorizationController(authorizationRequests: [request])
        authorizationController.delegate = self
        authorizationController.presentationContextProvider = self
        authorizationController.performRequests()
    }
}

// MARK: - ASAuthorizationControllerDelegate
extension AppleSignInManager: ASAuthorizationControllerDelegate {
    
    func authorizationController(controller: ASAuthorizationController, 
                                didCompleteWithAuthorization authorization: ASAuthorization) {
        
        guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential else {
            print("Failed to get Apple ID credential")
            return
        }
        
        // Extract ID token
        guard let identityTokenData = appleIDCredential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            print("Failed to get identity token")
            return
        }
        
        // Send to backend
        authenticateWithBackend(idToken: identityToken)
    }
    
    func authorizationController(controller: ASAuthorizationController, 
                                didCompleteWithError error: Error) {
        print("Apple Sign In failed: \(error.localizedDescription)")
    }
}

// MARK: - Backend Authentication
extension AppleSignInManager {
    
    func authenticateWithBackend(idToken: String) {
        let url = URL(string: "https://api.worklenz.com/auth/apple/mobile")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "idToken": idToken,
            "timezone": TimeZone.current.identifier
        ]
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            guard let data = data,
                  let httpResponse = response as? HTTPURLResponse else {
                print("Network error: \(error?.localizedDescription ?? "Unknown")")
                return
            }
            
            if httpResponse.statusCode == 200 {
                // Parse response
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    print("Authentication successful: \(json)")
                    
                    // Extract session info
                    let sessionId = json["sessionId"] as? String
                    let sessionName = json["sessionName"] as? String
                    
                    // Store session for future API calls
                    self.storeSession(sessionId: sessionId, sessionName: sessionName)
                }
            } else {
                print("Authentication failed with status: \(httpResponse.statusCode)")
            }
        }.resume()
    }
    
    func storeSession(sessionId: String?, sessionName: String?) {
        // Store session in UserDefaults or Keychain
        UserDefaults.standard.set(sessionId, forKey: "sessionId")
        UserDefaults.standard.set(sessionName, forKey: "sessionName")
    }
}

// MARK: - ASAuthorizationControllerPresentationContextProviding
extension AppleSignInManager: ASAuthorizationControllerPresentationContextProviding {
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return UIApplication.shared.windows.first!
    }
}
```

### 6.2 Request/Response Format

**Request**:
```json
POST /auth/apple/mobile
Content-Type: application/json

{
  "idToken": "eyJraWQiOiJXNldjT0tCIiwiYWxnIjoiUlMyNTYifQ...",
  "timezone": "America/New_York"
}
```

**Success Response**:
```json
{
  "done": true,
  "message": "User successfully logged in",
  "user": {
    "id": "uuid-here",
    "name": "Apple User",
    "email": "user@example.com",
    "active_team": "team-uuid",
    "avatar_url": null,
    "setup_completed": false,
    "build_v": "1.4.16"
  },
  "authenticated": true,
  "sessionId": "session-id-here",
  "sessionName": "worklenz.sid",
  "newSessionId": "session-id-here"
}
```

**Error Responses**:
```json
// Missing ID token
{
  "done": false,
  "message": "Apple ID token is required",
  "body": null
}

// Invalid token
{
  "done": false,
  "message": "Invalid Apple ID token",
  "body": null
}

// Token expired
{
  "done": false,
  "message": "Apple ID token has expired",
  "body": null
}

// Account conflict
{
  "done": false,
  "message": "This account is linked to Google. Please sign in with Google.",
  "body": null
}

// Email required for new user
{
  "done": false,
  "message": "Email is required for new user registration. Please sign in with Apple again and provide your email.",
  "body": null
}
```

---

## 7. Deployment Checklist

### 7.1 Pre-Deployment

- [ ] Review all code changes
- [ ] Run unit tests
- [ ] Run integration tests
- [ ] Test in staging environment
- [ ] Update API documentation
- [ ] Review security implications

### 7.2 Database Migration

- [ ] Backup production database
- [ ] Test migration on staging database
- [ ] Run migration on production database
- [ ] Verify `apple_id` column exists
- [ ] Verify index created successfully
- [ ] Test `register_apple_user` function

### 7.3 Environment Configuration

- [ ] Add Apple environment variables to production `.env`
- [ ] Configure Apple Developer account
- [ ] Set up iOS Bundle ID
- [ ] Enable "Sign in with Apple" capability
- [ ] Test with production credentials

### 7.4 Monitoring

- [ ] Set up error logging for Apple auth
- [ ] Monitor authentication success/failure rates
- [ ] Track new user registrations via Apple
- [ ] Monitor JWKS key fetch performance
- [ ] Set up alerts for authentication failures

---

## 8. Rollback Plan

If issues arise after deployment:

### 8.1 Immediate Rollback

1. **Disable Apple Sign-In route**:
   ```typescript
   // Comment out in auth/index.ts
   // authRouter.post("/apple/mobile", AuthController.appleMobileAuthPassport);
   ```

2. **Redeploy without Apple Sign-In code**

### 8.2 Database Rollback

```sql
-- Remove apple_id column (only if no users have apple_id set)
DROP INDEX IF EXISTS idx_users_apple_id;
ALTER TABLE users DROP COLUMN IF EXISTS apple_id;
DROP FUNCTION IF EXISTS register_apple_user(json);
```

**⚠️ Warning**: Only rollback database if no users have signed in with Apple yet!

---

## 9. Future Enhancements

### 9.1 Potential Improvements

1. **Account Linking**: Allow users to link Apple ID to existing accounts
2. **Android Support**: Add Android package name support
3. **Web Support**: Implement web-based Apple OAuth flow
4. **Revocation Handling**: Handle Apple account revocation events
5. **Token Refresh**: Implement refresh token flow (if needed)
6. **Analytics**: Track Apple Sign-In usage metrics

### 9.2 Apple Features to Consider

1. **Private Relay Email**: Already supported
2. **Name Handling**: Apple provides name only on first sign-in
3. **Credential State**: Check credential state on app launch
4. **Revocation Notifications**: Handle account deletion/revocation

---

## 10. Summary

This implementation plan provides a **complete, production-ready solution** for Apple Sign-In in the Worklenz mobile application. The architecture follows the existing Google OAuth pattern while properly handling Apple's unique requirements:

✅ **JWT-based token verification** with Apple's public keys
✅ **Email privacy handling** (email may not be provided on subsequent logins)
✅ **Account conflict prevention** (Google/password accounts)
✅ **Session-based authentication** (consistent with existing system)
✅ **Comprehensive error handling** and security measures
✅ **Database migration** with rollback support
✅ **Testing strategy** with unit and integration tests
✅ **Mobile integration guide** for iOS developers

### Implementation Timeline

- **Phase 1-2** (Database & Dependencies): 1-2 hours
- **Phase 3-4** (Environment & Strategy): 2-3 hours
- **Phase 5-7** (Integration & Routes): 2-3 hours
- **Phase 8** (Updates & Testing): 2-3 hours
- **Total Estimated Time**: 7-11 hours

### Key Differences from Reference Implementation

The reference implementation (TripSyncGo) uses:
- JWT tokens for authentication
- Multiple user types (tourist/service_provider)
- Firebase push notifications

Worklenz uses:
- Session-based authentication
- Single user type with teams/organizations
- No Firebase integration (yet)

This plan adapts the reference architecture to fit Worklenz's existing patterns while maintaining security and best practices.

---

**Document Version**: 1.0
**Last Updated**: November 12, 2025
**Author**: AI Assistant (Kiro)
**Status**: Ready for Implementation
