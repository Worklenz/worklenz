# Apple Sign-In Implementation Guide for Worklenz

## Overview

This guide provides step-by-step instructions for deploying the Apple Sign-In feature to the Worklenz backend.

---

## ✅ Implementation Checklist

### Phase 1: Database Migration

- [ ] **Step 1**: Run the first migration to add `apple_id` column
  ```bash
  psql -U postgres -d worklenz_bz_db -f database/migrations/20251112000001-add-apple-sign-in-support.sql
  ```

- [ ] **Step 2**: Run the second migration to add `register_apple_user` function
  ```bash
  psql -U postgres -d worklenz_bz_db -f database/migrations/20251112000002-add-register-apple-user-function.sql
  ```

- [ ] **Step 3**: Verify migrations
  ```sql
  -- Check if apple_id column exists
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'users' AND column_name = 'apple_id';

  -- Check if function exists
  SELECT proname FROM pg_proc WHERE proname = 'register_apple_user';

  -- Check if index exists
  SELECT indexname FROM pg_indexes WHERE tablename = 'users' AND indexname = 'idx_users_apple_id';
  ```

### Phase 2: Install Dependencies

- [ ] **Step 1**: Install the new npm package
  ```bash
  cd worklenz-backend
  npm install jwks-rsa@^3.2.0
  ```

- [ ] **Step 2**: Verify installation
  ```bash
  npm list jwks-rsa
  # Should show: jwks-rsa@3.2.0
  ```

### Phase 3: Environment Configuration

- [ ] **Step 1**: Update `.env` file with your Apple credentials
  ```bash
  # Apple Sign-In Configuration
  APPLE_CLIENT_ID=com.yourcompany.worklenz.service
  APPLE_IOS_CLIENT_ID=com.yourcompany.worklenz.mobile
  APPLE_ANDROID_CLIENT_ID=com.yourcompany.worklenz.mobile.android
  ```

- [ ] **Step 2**: Configure Apple Developer Account
  1. Go to [Apple Developer Portal](https://developer.apple.com/)
  2. Create an App ID with "Sign in with Apple" capability
  3. Note your Bundle ID (use for `APPLE_IOS_CLIENT_ID`)
  4. (Optional) Create Service ID for web OAuth

### Phase 4: Build and Deploy

- [ ] **Step 1**: Build the TypeScript code
  ```bash
  npm run build:prod
  ```

- [ ] **Step 2**: Verify no TypeScript errors
  ```bash
  npm run tsc
  ```

- [ ] **Step 3**: Run tests (if available)
  ```bash
  npm test
  ```

- [ ] **Step 4**: Start the server
  ```bash
  npm start
  ```

### Phase 5: Testing

- [ ] **Step 1**: Test the endpoint is accessible
  ```bash
  curl -X POST http://localhost:3000/auth/apple/mobile \
    -H "Content-Type: application/json" \
    -d '{"idToken": "test"}'
  
  # Should return 400 with "Invalid Apple ID token format"
  ```

- [ ] **Step 2**: Test with iOS app
  - Implement Apple Sign-In in your iOS app
  - Send ID token to `/auth/apple/mobile`
  - Verify successful authentication

- [ ] **Step 3**: Test account scenarios
  - [ ] New user registration
  - [ ] Existing user login
  - [ ] Email privacy (subsequent logins without email)
  - [ ] Account conflict (existing password account)
  - [ ] Account conflict (existing Google account)

---

## 📁 Files Created/Modified

### New Files Created:
1. `database/migrations/20251112000001-add-apple-sign-in-support.sql`
2. `database/migrations/20251112000002-add-register-apple-user-function.sql`
3. `src/passport/passport-strategies/passport-apple-mobile.ts`
4. `docs/APPLE_SIGN_IN_IMPLEMENTATION_GUIDE.md`

### Files Modified:
1. `package.json` - Added `jwks-rsa` dependency
2. `src/passport/index.ts` - Registered Apple strategy
3. `src/controllers/auth-controller.ts` - Added `appleMobileAuthPassport` method and updated `reset_password`
4. `src/routes/auth/index.ts` - Added `/auth/apple/mobile` route
5. `.env` - Added Apple configuration variables

---

## 🔧 API Documentation

### Endpoint: POST /auth/apple/mobile

**Description**: Authenticates users via Apple Sign-In for mobile apps

**Request Body**:
```json
{
  "idToken": "eyJraWQiOiJXNldjT0tCIiwiYWxnIjoiUlMyNTYifQ...",
  "timezone": "America/New_York"  // Optional, defaults to UTC
}
```

**Success Response (200)**:
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

| Status | Message | Description |
|--------|---------|-------------|
| 400 | "Apple ID token is required" | Missing idToken in request |
| 400 | "Invalid Apple ID token format" | Malformed JWT token |
| 400 | "Invalid Apple ID token" | Token signature verification failed |
| 400 | "Apple ID token has expired" | Token past expiration time |
| 400 | "An account with email X already exists..." | Email conflict with password account |
| 400 | "This account is linked to Google..." | Email conflict with Google account |
| 400 | "Email is required for new user registration..." | New user without email |
| 500 | "Authentication failed" | Server error during authentication |
| 500 | "Session creation failed" | Error creating user session |

---

## 🔒 Security Features

### Token Verification
- ✅ JWT signature verification using Apple's public keys (JWKS)
- ✅ Issuer validation (`https://appleid.apple.com`)
- ✅ Audience validation (Bundle ID matching)
- ✅ Expiration check
- ✅ Algorithm validation (RS256 only)

### Account Security
- ✅ Prevents linking to existing password accounts
- ✅ Prevents linking to existing Google accounts
- ✅ Email verification status checked
- ✅ Session-based authentication with secure cookies

### Privacy Features
- ✅ Handles Apple's private relay emails
- ✅ Works when email is not provided (subsequent logins)
- ✅ Updates email if provided on subsequent logins

---

## 🐛 Troubleshooting

### Issue: "No Apple client IDs configured"
**Solution**: Ensure environment variables are set in `.env`:
```bash
APPLE_CLIENT_ID=com.yourcompany.worklenz.service
APPLE_IOS_CLIENT_ID=com.yourcompany.worklenz.mobile
```

### Issue: "Invalid Apple ID token"
**Possible Causes**:
1. Token expired (tokens are valid for 10 minutes)
2. Wrong Bundle ID in token audience
3. Token from different Apple app

**Solution**: 
- Verify Bundle ID matches `APPLE_IOS_CLIENT_ID`
- Ensure token is fresh (< 10 minutes old)
- Check Apple Developer Portal configuration

### Issue: "Unable to verify Apple ID token"
**Possible Causes**:
1. Network issue connecting to Apple's JWKS endpoint
2. Apple's public keys endpoint is down

**Solution**:
- Check server internet connectivity
- Verify `https://appleid.apple.com/auth/keys` is accessible
- Check server logs for detailed error

### Issue: Database function not found
**Solution**: Run the migration:
```bash
psql -U postgres -d worklenz_bz_db -f database/migrations/20251112000002-add-register-apple-user-function.sql
```

---

## 📱 iOS Integration Example

```swift
import AuthenticationServices

class AppleSignInManager: NSObject {
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

extension AppleSignInManager: ASAuthorizationControllerDelegate {
    func authorizationController(controller: ASAuthorizationController, 
                                didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let appleIDCredential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let identityTokenData = appleIDCredential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            return
        }
        
        // Send to backend
        let url = URL(string: "https://api.worklenz.com/auth/apple/mobile")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "idToken": identityToken,
            "timezone": TimeZone.current.identifier
        ]
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            // Handle response
        }.resume()
    }
}
```

---

## 🔄 Rollback Plan

If you need to rollback the implementation:

### Step 1: Disable the route
Comment out in `src/routes/auth/index.ts`:
```typescript
// authRouter.post("/apple/mobile", AuthController.appleMobileAuthPassport);
```

### Step 2: Rebuild and deploy
```bash
npm run build:prod
npm start
```

### Step 3: (Optional) Remove database changes
**⚠️ WARNING**: Only do this if no users have signed in with Apple!

```sql
-- Remove function
DROP FUNCTION IF EXISTS register_apple_user(json);

-- Remove index
DROP INDEX IF EXISTS idx_users_apple_id;

-- Remove column
ALTER TABLE users DROP COLUMN IF EXISTS apple_id;
```

---

## 📊 Monitoring

### Key Metrics to Monitor:
1. **Authentication Success Rate**: Track successful vs failed Apple logins
2. **New User Registrations**: Monitor new users via Apple Sign-In
3. **Token Verification Errors**: Track JWT verification failures
4. **JWKS Fetch Performance**: Monitor Apple's public key fetch times

### Logging:
All errors are logged using the `log_error` utility:
- Token verification errors
- Database errors
- Session creation errors

Check logs for:
```
"Apple mobile authentication error:"
"Failed to fetch Apple signing key:"
"Apple login session creation error:"
"Apple login session save error:"
```

---

## ✅ Post-Deployment Verification

After deployment, verify:

- [ ] Database migrations applied successfully
- [ ] `apple_id` column exists in users table
- [ ] `register_apple_user` function exists
- [ ] Index `idx_users_apple_id` created
- [ ] `/auth/apple/mobile` endpoint responds
- [ ] Environment variables configured
- [ ] iOS app can authenticate successfully
- [ ] New user registration works
- [ ] Existing user login works
- [ ] Password reset blocked for Apple users
- [ ] Session persistence works

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server logs for detailed error messages
3. Verify Apple Developer Portal configuration
4. Check iOS app implementation

---

**Document Version**: 1.0  
**Last Updated**: November 12, 2025  
**Status**: Ready for Deployment
