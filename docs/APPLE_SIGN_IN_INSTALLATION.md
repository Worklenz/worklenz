# 🍎 Apple Sign-In Installation Instructions

## ✅ Implementation Status: COMPLETE

All code has been implemented and is ready for deployment. Follow these steps to activate the feature.

---

## 📋 Pre-Installation Checklist

Before you begin, ensure you have:
- [ ] PostgreSQL database access
- [ ] Node.js 20+ installed
- [ ] npm 8.11+ installed
- [ ] Apple Developer account (for Bundle ID configuration)
- [ ] Access to `.env` file

---

## 🚀 Installation Steps

### Step 1: Install NPM Dependencies (Required)

```bash
cd worklenz-backend
npm install
```

This will install:
- `jwks-rsa@^3.2.0` - For Apple's public key verification
- `@types/jwks-rsa@^6.0.4` - TypeScript types

**Verification**:
```bash
npm list jwks-rsa
# Should show: jwks-rsa@3.2.0
```

---

### Step 2: Run Database Migrations (Required)

#### Migration 1: Add apple_id Column
```bash
psql -U postgres -d worklenz_bz_db -f database/migrations/20251112000001-add-apple-sign-in-support.sql
```

**Expected Output**:
```
ALTER TABLE
CREATE INDEX
COMMENT
NOTICE:  ✓ apple_id column successfully added to users table
NOTICE:  ✓ Index idx_users_apple_id successfully created
```

#### Migration 2: Add register_apple_user Function
```bash
psql -U postgres -d worklenz_bz_db -f database/migrations/20251112000002-add-register-apple-user-function.sql
```

**Expected Output**:
```
DROP FUNCTION
CREATE FUNCTION
COMMENT
NOTICE:  ✓ Function register_apple_user successfully created
```

**Verification**:
```sql
-- Check column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'apple_id';

-- Check function exists
SELECT proname FROM pg_proc WHERE proname = 'register_apple_user';

-- Check index exists
SELECT indexname FROM pg_indexes 
WHERE tablename = 'users' AND indexname = 'idx_users_apple_id';
```

---

### Step 3: Configure Environment Variables (Required)

Edit `worklenz-backend/.env` and update the Apple configuration:

```bash
# Apple Sign-In Configuration
APPLE_CLIENT_ID=com.yourcompany.worklenz.service
APPLE_IOS_CLIENT_ID=com.yourcompany.worklenz.mobile
APPLE_ANDROID_CLIENT_ID=com.yourcompany.worklenz.mobile.android
```

**Replace with your actual values**:
- `APPLE_CLIENT_ID`: Your Apple Service ID (optional for mobile-only)
- `APPLE_IOS_CLIENT_ID`: Your iOS app Bundle ID (required)
- `APPLE_ANDROID_CLIENT_ID`: Your Android package name (optional)

**Apple Developer Portal Setup**:
1. Go to https://developer.apple.com/account/
2. Navigate to "Certificates, Identifiers & Profiles"
3. Create/verify your App ID
4. Enable "Sign in with Apple" capability
5. Note your Bundle ID (use for `APPLE_IOS_CLIENT_ID`)

---

### Step 4: Build the Application (Required)

```bash
cd worklenz-backend
npm run build:prod
```

**Expected Output**:
```
> worklenz-backend@1.4.16 build:prod
> npm run clean && npm run compile:prod && npm run copy && npm run minify && npm run compress

✓ Build completed successfully
```

**Verification**:
```bash
# Check for TypeScript errors
npm run tsc

# Should show: No errors
```

---

### Step 5: Start the Server (Required)

```bash
npm start
```

**Expected Output**:
```
Server running on port 3000
```

---

### Step 6: Test the Installation (Recommended)

#### Test 1: Endpoint Accessibility
```bash
curl -X POST http://localhost:3000/auth/apple/mobile \
  -H "Content-Type: application/json" \
  -d '{"idToken": "test"}'
```

**Expected Response** (400 Bad Request):
```json
{
  "done": false,
  "message": "Invalid Apple ID token format",
  "body": null
}
```

✅ If you see this response, the endpoint is working correctly!

#### Test 2: Missing Token
```bash
curl -X POST http://localhost:3000/auth/apple/mobile \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response** (400 Bad Request):
```json
{
  "done": false,
  "message": "Apple ID token is required",
  "body": null
}
```

---

## 📱 iOS App Integration

Once the backend is deployed, integrate with your iOS app:

### 1. Enable Sign in with Apple in Xcode
- Open your Xcode project
- Select your target
- Go to "Signing & Capabilities"
- Click "+ Capability"
- Add "Sign in with Apple"

### 2. Implement Apple Sign-In
See `docs/APPLE_SIGN_IN_QUICK_START.md` for complete iOS code example.

### 3. Test with iOS App
- Run your iOS app
- Trigger Apple Sign-In
- Verify successful authentication
- Check session cookie is stored

---

## ✅ Post-Installation Verification

Run through this checklist to ensure everything is working:

### Database
- [ ] `apple_id` column exists in `users` table
- [ ] Index `idx_users_apple_id` created
- [ ] Function `register_apple_user` exists

### Backend
- [ ] Dependencies installed (`jwks-rsa`)
- [ ] No TypeScript compilation errors
- [ ] Server starts without errors
- [ ] `/auth/apple/mobile` endpoint responds

### Configuration
- [ ] Environment variables set in `.env`
- [ ] Apple Bundle ID configured
- [ ] Apple Developer Portal setup complete

### Testing
- [ ] Endpoint returns 400 for invalid token (expected)
- [ ] iOS app can authenticate successfully
- [ ] New user registration works
- [ ] Existing user login works
- [ ] Session persists across requests

---

## 🐛 Troubleshooting

### Issue: "Cannot find module 'jwks-rsa'"
**Solution**: Run `npm install` in the `worklenz-backend` directory

### Issue: "Function register_apple_user does not exist"
**Solution**: Run migration 2:
```bash
psql -U postgres -d worklenz_bz_db -f database/migrations/20251112000002-add-register-apple-user-function.sql
```

### Issue: "Column apple_id does not exist"
**Solution**: Run migration 1:
```bash
psql -U postgres -d worklenz_bz_db -f database/migrations/20251112000001-add-apple-sign-in-support.sql
```

### Issue: "No Apple client IDs configured"
**Solution**: Add to `.env`:
```bash
APPLE_IOS_CLIENT_ID=com.yourcompany.worklenz.mobile
```

### Issue: "Invalid Apple ID token"
**Possible Causes**:
- Bundle ID mismatch
- Token expired (> 10 minutes old)
- Wrong Apple Developer Portal configuration

**Solution**:
- Verify Bundle ID matches `APPLE_IOS_CLIENT_ID`
- Ensure token is fresh
- Check Apple Developer Portal setup

---

## 📊 Monitoring

After deployment, monitor:

### Logs to Watch
```bash
# Authentication errors
grep "Apple mobile authentication error" logs/app.log

# Token verification errors
grep "Failed to fetch Apple signing key" logs/app.log

# Session errors
grep "Apple login session" logs/app.log
```

### Metrics to Track
- Apple Sign-In success rate
- New user registrations via Apple
- Token verification failures
- Session creation errors

---

## 🔄 Rollback (If Needed)

If you need to rollback:

### 1. Disable the Route
Edit `src/routes/auth/index.ts`:
```typescript
// Comment out this line:
// authRouter.post("/apple/mobile", AuthController.appleMobileAuthPassport);
```

### 2. Rebuild and Deploy
```bash
npm run build:prod
npm start
```

### 3. (Optional) Remove Database Changes
**⚠️ WARNING**: Only if no users have signed in with Apple!

```sql
DROP FUNCTION IF EXISTS register_apple_user(json);
DROP INDEX IF EXISTS idx_users_apple_id;
ALTER TABLE users DROP COLUMN IF EXISTS apple_id;
```

---

## 📚 Additional Documentation

- **Quick Start**: `docs/APPLE_SIGN_IN_QUICK_START.md`
- **Implementation Guide**: `docs/APPLE_SIGN_IN_IMPLEMENTATION_GUIDE.md`
- **Architecture Plan**: `docs/APPLE_SIGN_IN_IMPLEMENTATION_PLAN.md`
- **Summary**: `docs/APPLE_SIGN_IN_SUMMARY.md`

---

## ✨ What's Next?

After successful installation:

1. **Test thoroughly** with iOS app
2. **Monitor logs** for any errors
3. **Track metrics** (success rate, new users)
4. **Update mobile app** to use Apple Sign-In
5. **Communicate** to users about new sign-in option

---

## 🎉 Success!

If all steps completed successfully, Apple Sign-In is now active on your Worklenz backend!

Users can now:
- ✅ Sign in with Apple from iOS app
- ✅ Register new accounts via Apple
- ✅ Maintain secure sessions
- ✅ Enjoy privacy-preserving authentication

---

**Installation Time**: ~10-15 minutes  
**Status**: Ready for Production  
**Support**: See troubleshooting section or check server logs
