# Apple Sign-In Web Implementation Guide

## Overview

This document describes the implementation of "Continue with Apple" for the Worklenz web application. The implementation follows the same OAuth 2.0 pattern as Google Sign-In and integrates seamlessly with the existing authentication system.

---

## Architecture

### Backend Components

1. **Passport Strategy** (`passport-apple-web.ts`)
   - Handles Apple OAuth 2.0 flow
   - Verifies user identity
   - Creates or logs in users
   - Manages team invitations

2. **Routes** (`routes/auth/index.ts`)
   - `GET /secure/apple` - Initiates Apple OAuth flow
   - `POST /secure/apple/verify` - Handles OAuth callback

3. **Passport Configuration** (`passport/index.ts`)
   - Registers Apple web strategy

### Frontend Components

1. **Login Page** (`pages/auth/LoginPage.tsx`)
   - Apple sign-in button
   - Event tracking
   - Redirect handling

2. **Signup Page** (`pages/auth/SignupPage.tsx`)
   - Apple sign-up button
   - Invitation parameter handling
   - Event tracking

3. **Assets**
   - Apple icon SVG (`assets/images/apple-icon.svg`)

4. **Translations**
   - English translations for Apple buttons
   - Extensible for other languages

---

## Implementation Details

### Backend

#### 1. Apple Web OAuth Strategy

**File**: `worklenz-backend/src/passport/passport-strategies/passport-apple-web.ts`

The strategy uses `passport-apple` package to handle OAuth 2.0 flow:

```typescript
export default new AppleStrategy(
  {
    clientID: process.env.APPLE_CLIENT_ID,
    teamID: process.env.APPLE_TEAM_ID,
    keyID: process.env.APPLE_KEY_ID,
    privateKeyLocation: process.env.APPLE_PRIVATE_KEY_PATH,
    callbackURL: process.env.APPLE_CALLBACK_URL,
    passReqToCallback: true,
    scope: ["name", "email"],
  },
  handleAppleWebAuth
);
```

**Key Features**:
- Checks for existing password-based accounts (prevents conflicts)
- Handles team/project invitations via state parameter
- Updates `apple_id` for existing users
- Registers new users via `register_apple_user()` database function
- Sends welcome email to new users

#### 2. Routes

**File**: `worklenz-backend/src/routes/auth/index.ts`

```typescript
// Initiate Apple OAuth
authRouter.get("/apple", (req, res, next) => {
  return passport.authenticate("apple", {
    scope: ["name", "email"],
    state: JSON.stringify({
      teamMember: req.query.teamMember || null,
      team: req.query.team || null,
      teamName: req.query.teamName || null,
      project: req.query.project || null
    })
  })(req, res, next);
});

// Handle OAuth callback
authRouter.post("/apple/verify", (req, res, next) => {
  let error = "";
  if ((req.session as any).error) {
    error = `?error=${encodeURIComponent((req.session as any).error as string)}`;
    delete (req.session as any).error;
  }

  const failureRedirect = process.env.LOGIN_FAILURE_REDIRECT + error;
  return passport.authenticate("apple", {
    failureRedirect,
    successRedirect: process.env.LOGIN_SUCCESS_REDIRECT
  })(req, res, next);
});
```

### Frontend

#### 1. Login Page

**File**: `worklenz-frontend/src/pages/auth/LoginPage.tsx`

**Changes**:
- Added Apple icon import
- Added `enableAppleLogin` environment variable check
- Added `handleAppleLogin` callback
- Added Apple sign-in button with conditional rendering
- Added event tracking for Apple login

```typescript
const handleAppleLogin = useCallback(() => {
  try {
    trackMixpanelEvent(evt_login_page_login);
    trackMixpanelEvent(evt_login_with_apple_click);
    window.location.href = `${import.meta.env.VITE_API_URL}/secure/apple`;
  } catch (error) {
    logger.error('Apple login failed', error);
  }
}, [trackMixpanelEvent]);
```

#### 2. Signup Page

**File**: `worklenz-frontend/src/pages/auth/SignupPage.tsx`

**Changes**:
- Added Apple icon import
- Added `enableAppleLogin` environment variable check
- Added `onAppleSignUpClick` handler with invitation parameters
- Added Apple sign-up button with conditional rendering
- Added event tracking for Apple signup

```typescript
const onAppleSignUpClick = () => {
  try {
    trackMixpanelEvent(evt_signup_with_apple_click);
    const queryParams = getInvitationQueryParams();
    const url = `${import.meta.env.VITE_API_URL}/secure/apple${queryParams ? `?${queryParams}` : ''}`;
    window.location.href = url;
  } catch (error) {
    message.error('Failed to redirect to Apple sign up');
  }
};
```

---

## Configuration

### Backend Environment Variables

**File**: `worklenz-backend/.env`

```bash
# Apple Sign-In Configuration (Web OAuth)
APPLE_CLIENT_ID=com.ceydigital.worklenz
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY_PATH=./keys/AuthKey_XXXXX.p8
APPLE_CALLBACK_URL=http://localhost:3000/auth/apple/callback

# iOS Bundle ID (for mobile)
APPLE_IOS_CLIENT_ID=com.ceydigital.worklenz
```

**Required for Web**:
- `APPLE_CLIENT_ID` - Service ID from Apple Developer Portal
- `APPLE_TEAM_ID` - Team ID from Apple Developer account
- `APPLE_KEY_ID` - Key ID for the private key
- `APPLE_PRIVATE_KEY_PATH` - Path to .p8 private key file
- `APPLE_CALLBACK_URL` - OAuth callback URL

### Frontend Environment Variables

**File**: `worklenz-frontend/.env.development`

```bash
# Apple Login
VITE_ENABLE_APPLE_LOGIN=false
```

Set to `true` to enable Apple sign-in buttons.

---

## Apple Developer Portal Setup

### 1. Create Service ID

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → **+** button
4. Select **Services IDs** → Continue
5. Enter:
   - Description: "Worklenz Web"
   - Identifier: `com.ceydigital.worklenz` (must match `APPLE_CLIENT_ID`)
6. Enable **Sign in with Apple**
7. Configure:
   - Primary App ID: Select your iOS app
   - Domains: `yourdomain.com`
   - Return URLs: `https://yourdomain.com/auth/apple/callback`

### 2. Create Private Key

1. Go to **Keys** → **+** button
2. Enter Key Name: "Worklenz Apple Sign-In Key"
3. Enable **Sign in with Apple**
4. Configure → Select your Primary App ID
5. Download the `.p8` file (save securely!)
6. Note the **Key ID** (10-character string)
7. Place `.p8` file in `worklenz-backend/keys/` directory

### 3. Get Team ID

1. Go to **Membership** in Apple Developer Portal
2. Copy your **Team ID** (10-character string)

---

## Database Requirements

The implementation uses the existing `register_apple_user()` database function created for mobile Apple Sign-In. No additional database changes are required.

**Existing Schema**:
```sql
-- users table already has apple_id column
ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_id TEXT;
CREATE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id);
```

---

## Testing

### Local Testing

1. **Update Environment Variables**:
   ```bash
   # Backend
   APPLE_CLIENT_ID=com.ceydigital.worklenz
   APPLE_TEAM_ID=YOUR_TEAM_ID
   APPLE_KEY_ID=YOUR_KEY_ID
   APPLE_PRIVATE_KEY_PATH=./keys/AuthKey_XXXXX.p8
   APPLE_CALLBACK_URL=http://localhost:3000/auth/apple/callback
   
   # Frontend
   VITE_ENABLE_APPLE_LOGIN=true
   ```

2. **Start Backend**:
   ```bash
   cd worklenz-backend
   npm start
   ```

3. **Start Frontend**:
   ```bash
   cd worklenz-frontend
   npm run dev
   ```

4. **Test Flow**:
   - Navigate to login/signup page
   - Click "Sign in with Apple" button
   - Redirected to Apple authorization page
   - Authorize and redirect back
   - User logged in successfully

### Production Testing

1. Update callback URL in Apple Developer Portal
2. Update `APPLE_CALLBACK_URL` environment variable
3. Deploy backend and frontend
4. Test complete OAuth flow

---

## Security Considerations

1. **Private Key Protection**:
   - Never commit `.p8` file to version control
   - Store securely with restricted access
   - Rotate keys periodically

2. **Account Conflicts**:
   - Strategy checks for existing password-based accounts
   - Prevents linking Apple ID to wrong account
   - Clear error messages for users

3. **Token Verification**:
   - Apple handles token verification via OAuth 2.0
   - Passport strategy validates all responses
   - Session-based authentication for security

4. **HTTPS Required**:
   - Apple requires HTTPS for production
   - Use valid SSL certificates
   - Configure proper CORS settings

---

## Error Handling

### Common Errors

1. **"Invalid client_id"**
   - Check `APPLE_CLIENT_ID` matches Service ID
   - Verify Service ID is enabled in Apple Developer Portal

2. **"Invalid redirect_uri"**
   - Check `APPLE_CALLBACK_URL` matches configured URL
   - Ensure URL is registered in Apple Developer Portal

3. **"Invalid private key"**
   - Verify `.p8` file path is correct
   - Check file permissions
   - Ensure Key ID matches

4. **"Account already exists"**
   - User has password-based account with same email
   - Instruct user to login with password
   - Consider account linking feature (future enhancement)

---

## Differences from Mobile Implementation

| Feature | Mobile | Web |
|---------|--------|-----|
| **Strategy** | Custom (JWT verification) | passport-apple (OAuth 2.0) |
| **Token Type** | ID Token (JWT) | Authorization Code |
| **Verification** | Manual JWT verification with Apple's public keys | OAuth 2.0 flow handled by passport-apple |
| **Private Key** | Not required | Required (.p8 file) |
| **Callback** | POST endpoint | POST endpoint (OAuth callback) |
| **Registration** | Disabled (mobile users must register via web) | Enabled (new users can register) |

---

## Future Enhancements

1. **Account Linking**
   - Allow users to link Apple ID to existing accounts
   - Merge accounts with same email

2. **Multi-Language Support**
   - Add translations for all supported languages
   - Localize error messages

3. **Analytics**
   - Track Apple sign-in conversion rates
   - Monitor authentication failures
   - A/B test button placement

4. **Revocation Handling**
   - Handle Apple account deletion events
   - Implement webhook for revocation notifications

---

## Dependencies

### Backend

```json
{
  "passport-apple": "^2.0.2"
}
```

### Frontend

No additional dependencies required.

---

## Rollback Plan

If issues arise:

1. **Disable Frontend**:
   ```bash
   # Set in .env
   VITE_ENABLE_APPLE_LOGIN=false
   ```

2. **Disable Backend Routes** (optional):
   ```typescript
   // Comment out in routes/auth/index.ts
   // authRouter.get("/apple", ...);
   // authRouter.post("/apple/verify", ...);
   ```

3. **Redeploy**

---

## Support

For issues or questions:
1. Check Apple Developer Portal configuration
2. Review server logs for detailed error messages
3. Verify environment variables are set correctly
4. Test with Apple's sandbox environment first

---

**Document Version**: 1.0  
**Last Updated**: December 8, 2024  
**Status**: Ready for Deployment
