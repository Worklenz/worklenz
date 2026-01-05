# Apple Sign-In Web - Quick Start Guide

## 🚀 Quick Setup (5 Minutes)

### Step 1: Install Backend Dependency

```bash
cd worklenz-backend
npm install passport-apple
```

### Step 2: Configure Apple Developer Portal

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. **Create Service ID**:
   - Identifiers → + → Services IDs
   - Identifier: `com.ceydigital.worklenz`
   - Enable "Sign in with Apple"
   - Configure domains and return URLs

3. **Create Private Key**:
   - Keys → + → Enable "Sign in with Apple"
   - Download `.p8` file
   - Save to `worklenz-backend/keys/AuthKey_XXXXX.p8`
   - Note the Key ID (10 characters)

4. **Get Team ID**:
   - Membership → Copy Team ID

### Step 3: Update Backend Environment

Edit `worklenz-backend/.env`:

```bash
# Apple Sign-In Configuration
APPLE_CLIENT_ID=com.ceydigital.worklenz
APPLE_TEAM_ID=YOUR_TEAM_ID_HERE
APPLE_KEY_ID=YOUR_KEY_ID_HERE
APPLE_PRIVATE_KEY_PATH=./keys/AuthKey_XXXXX.p8
APPLE_CALLBACK_URL=http://localhost:3000/auth/apple/callback
```

### Step 4: Update Frontend Environment

Edit `worklenz-frontend/.env.development`:

```bash
# Enable Apple Login
VITE_ENABLE_APPLE_LOGIN=true
```

### Step 5: Start Servers

```bash
# Terminal 1 - Backend
cd worklenz-backend
npm start

# Terminal 2 - Frontend
cd worklenz-frontend
npm run dev
```

### Step 6: Test

1. Open http://localhost:5173/auth/login
2. Click "Sign in with Apple" button
3. Authorize with your Apple ID
4. ✅ You're logged in!

---

## 📋 Checklist

- [ ] `passport-apple` installed
- [ ] Apple Service ID created
- [ ] Private key downloaded and saved
- [ ] Backend `.env` updated with all Apple variables
- [ ] Frontend `.env` has `VITE_ENABLE_APPLE_LOGIN=true`
- [ ] Both servers running
- [ ] Apple button visible on login/signup pages
- [ ] OAuth flow completes successfully

---

## 🔧 Troubleshooting

### Button Not Showing
- Check `VITE_ENABLE_APPLE_LOGIN=true` in frontend `.env`
- Restart frontend dev server

### "Invalid client_id" Error
- Verify `APPLE_CLIENT_ID` matches Service ID in Apple Developer Portal
- Check Service ID is enabled for Sign in with Apple

### "Invalid redirect_uri" Error
- Ensure `APPLE_CALLBACK_URL` matches URL configured in Apple Developer Portal
- For local testing: `http://localhost:3000/auth/apple/callback`
- For production: `https://yourdomain.com/auth/apple/callback`

### "Invalid private key" Error
- Check `.p8` file path in `APPLE_PRIVATE_KEY_PATH`
- Verify file exists and has correct permissions
- Ensure `APPLE_KEY_ID` matches the key in Apple Developer Portal

---

## 🌐 Production Deployment

1. **Update Apple Developer Portal**:
   - Add production domain to Service ID
   - Add production callback URL

2. **Update Backend `.env`**:
   ```bash
   APPLE_CALLBACK_URL=https://yourdomain.com/auth/apple/callback
   ```

3. **Update Frontend `.env.production`**:
   ```bash
   VITE_ENABLE_APPLE_LOGIN=true
   VITE_API_URL=https://api.yourdomain.com
   ```

4. **Deploy**:
   ```bash
   # Backend
   cd worklenz-backend
   npm run build:prod
   npm start
   
   # Frontend
   cd worklenz-frontend
   npm run build
   ```

---

## 📚 Additional Resources

- [Full Implementation Guide](./APPLE_SIGN_IN_WEB_IMPLEMENTATION.md)
- [Implementation Summary](./APPLE_WEB_IMPLEMENTATION_SUMMARY.md)
- [Apple Developer Documentation](https://developer.apple.com/sign-in-with-apple/)

---

**Setup Time**: ~5 minutes  
**Status**: Ready to Use
