# Fix: Apple "Invalid web redirect url" Error

## The Problem

You're getting "Invalid web redirect url" error because:
1. The callback URL doesn't match what's configured in Apple Developer Portal
2. Apple has restrictions on localhost URLs

## The Correct Callback URL

The callback URL should be:
```
http://localhost:3000/secure/apple/verify
```

NOT:
```
http://localhost:3000/auth/apple/callback  ❌
```

## Quick Fix

### Step 1: Update Your .env File

Edit `worklenz-backend/.env`:

```bash
APPLE_CALLBACK_URL=http://localhost:3000/secure/apple/verify
```

### Step 2: Choose Testing Method

Apple Sign-In has issues with `localhost`. Choose one option:

---

## Option A: Use ngrok (Recommended for Local Testing)

### 1. Install ngrok

```bash
# Download from https://ngrok.com/download
```

### 2. Start ngrok

```bash
ngrok http 3000
```

You'll see:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
```

### 3. Update Apple Developer Portal

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. **Certificates, Identifiers & Profiles** → **Identifiers**
3. Select your Service ID: `com.ceydigital.worklenz`
4. Click **Configure** next to "Sign in with Apple"
5. Add:
   - **Domains**: `abc123.ngrok-free.app` (your ngrok domain, without https://)
   - **Return URLs**: `https://abc123.ngrok-free.app/secure/apple/verify`
6. Click **Save** → **Continue** → **Save**

### 4. Update Backend .env

```bash
APPLE_CALLBACK_URL=https://abc123.ngrok-free.app/secure/apple/verify
```

### 5. Update Frontend .env

```bash
VITE_API_URL=https://abc123.ngrok-free.app
VITE_ENABLE_APPLE_LOGIN=true
```

### 6. Restart Backend

```bash
cd worklenz-backend
npm start
```

### 7. Test

1. Open frontend: `http://localhost:5173/auth/login`
2. Click "Sign in with Apple"
3. ✅ Should work!

---

## Option B: Try Localhost (May Not Work)

Apple officially doesn't support localhost, but you can try:

### 1. Update Apple Developer Portal

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. **Certificates, Identifiers & Profiles** → **Identifiers**
3. Select your Service ID: `com.ceydigital.worklenz`
4. Click **Configure** next to "Sign in with Apple"
5. Add:
   - **Domains**: `localhost`
   - **Return URLs**: `http://localhost:3000/secure/apple/verify`
6. Click **Save** → **Continue** → **Save**

### 2. Backend .env

```bash
APPLE_CALLBACK_URL=http://localhost:3000/secure/apple/verify
```

### 3. Frontend .env

```bash
VITE_API_URL=http://localhost:3000
VITE_ENABLE_APPLE_LOGIN=true
```

### 4. Test

This may or may not work depending on Apple's current policies.

---

## Option C: Use Staging/Production Domain

If you have a deployed environment:

### 1. Update Apple Developer Portal

Add your domain:
- **Domains**: `staging.yourdomain.com`
- **Return URLs**: `https://staging.yourdomain.com/secure/apple/verify`

### 2. Update Backend .env

```bash
APPLE_CALLBACK_URL=https://staging.yourdomain.com/secure/apple/verify
```

### 3. Deploy and Test

---

## Verification Checklist

- [ ] Backend `.env` has correct callback URL
- [ ] Apple Developer Portal has matching return URL
- [ ] Domain is added to Apple Developer Portal
- [ ] Backend server restarted
- [ ] Frontend has `VITE_ENABLE_APPLE_LOGIN=true`
- [ ] Apple button visible on login page

---

## Common Mistakes

### ❌ Wrong Path
```
http://localhost:3000/auth/apple/callback  ❌
```

### ✅ Correct Path
```
http://localhost:3000/secure/apple/verify  ✅
```

### ❌ Missing Domain in Apple Portal
You must add the domain (without protocol) in Apple Developer Portal

### ❌ URL Mismatch
The URL in `.env` must EXACTLY match the URL in Apple Developer Portal

---

## For Production

When deploying to production:

### 1. Apple Developer Portal
- **Domain**: `yourdomain.com`
- **Return URL**: `https://yourdomain.com/secure/apple/verify`

### 2. Backend .env
```bash
APPLE_CALLBACK_URL=https://yourdomain.com/secure/apple/verify
```

### 3. Frontend .env.production
```bash
VITE_API_URL=https://api.yourdomain.com
VITE_ENABLE_APPLE_LOGIN=true
```

---

## Still Having Issues?

1. **Check Apple Developer Portal**:
   - Service ID is enabled for "Sign in with Apple"
   - Domain is added (without https://)
   - Return URL matches exactly

2. **Check Backend Logs**:
   ```bash
   cd worklenz-backend
   npm start
   # Look for any errors
   ```

3. **Verify Environment Variables**:
   ```bash
   # Backend
   echo $APPLE_CALLBACK_URL
   
   # Should output: http://localhost:3000/secure/apple/verify
   # or your ngrok URL
   ```

4. **Clear Browser Cache**:
   - Apple may cache redirect URLs
   - Try incognito/private mode

---

**Recommended**: Use ngrok for local testing, it's the most reliable method.
