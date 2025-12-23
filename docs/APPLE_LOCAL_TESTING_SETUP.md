# Apple Sign-In Local Testing Setup

## Problem

Apple Sign-In doesn't work well with `localhost` URLs. You'll get "Invalid web redirect url" error.

## Solution: Use ngrok

### Step 1: Install ngrok

```bash
# Download from https://ngrok.com/download
# Or install via package manager:

# macOS
brew install ngrok

# Windows (Chocolatey)
choco install ngrok

# Or download directly from https://ngrok.com/download
```

### Step 2: Start ngrok Tunnel

```bash
# Tunnel to your backend server (port 3000)
ngrok http 3000
```

You'll see output like:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

Copy the `https://abc123.ngrok.io` URL.

### Step 3: Update Apple Developer Portal

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. **Identifiers** → Select Service ID (`com.ceydigital.worklenz`)
3. **Configure** Sign in with Apple
4. Add:
   - **Domain**: `abc123.ngrok.io` (without https://)
   - **Return URL**: `https://abc123.ngrok.io/auth/apple/callback`
5. **Save**

### Step 4: Update Backend .env

```bash
# Use ngrok URL
APPLE_CALLBACK_URL=https://abc123.ngrok.io/auth/apple/callback
```

### Step 5: Update Frontend .env

```bash
# Point frontend to ngrok URL
VITE_API_URL=https://abc123.ngrok.io
```

### Step 6: Restart Servers

```bash
# Backend
cd worklenz-backend
npm start

# Frontend (in new terminal)
cd worklenz-frontend
npm run dev
```

### Step 7: Test

1. Open frontend: `http://localhost:5173/auth/login`
2. Click "Sign in with Apple"
3. Should redirect to Apple successfully
4. After authorization, redirects back via ngrok

---

## Alternative: Use Production Domain

If you have a staging/production domain:

### Step 1: Update Apple Developer Portal

Add your domain:
- **Domain**: `staging.yourdomain.com`
- **Return URL**: `https://staging.yourdomain.com/auth/apple/callback`

### Step 2: Update Backend .env

```bash
APPLE_CALLBACK_URL=https://staging.yourdomain.com/auth/apple/callback
```

### Step 3: Deploy and Test

Deploy to staging and test there.

---

## Troubleshooting

### ngrok URL Changes
- Free ngrok URLs change on restart
- Update Apple Developer Portal each time
- Or use ngrok paid plan for static URLs

### CORS Issues
- Ensure backend CORS allows ngrok domain
- Update `SERVER_CORS` in backend `.env`

### Session Issues
- Ensure cookies work across ngrok
- Check `COOKIE_SECRET` and `SESSION_SECRET`

---

## For Production

Once ready for production:

1. **Update Apple Developer Portal**:
   - Domain: `yourdomain.com`
   - Return URL: `https://yourdomain.com/auth/apple/callback`

2. **Update Backend .env**:
   ```bash
   APPLE_CALLBACK_URL=https://yourdomain.com/auth/apple/callback
   ```

3. **Deploy**

---

**Note**: Apple requires HTTPS for all redirect URLs except localhost (which has limitations).
