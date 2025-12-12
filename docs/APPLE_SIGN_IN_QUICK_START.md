# Apple Sign-In Quick Start Guide

## 🚀 5-Minute Setup

### 1. Install Dependencies (1 min)
```bash
cd worklenz-backend
npm install
```

### 2. Run Database Migrations (2 min)
```bash
# Add apple_id column
psql -U postgres -d worklenz_bz_db -f database/migrations/20251112000001-add-apple-sign-in-support.sql

# Add register_apple_user function
psql -U postgres -d worklenz_bz_db -f database/migrations/20251112000002-add-register-apple-user-function.sql
```

### 3. Configure Environment (1 min)
Edit `.env`:
```bash
APPLE_CLIENT_ID=com.yourcompany.worklenz.service
APPLE_IOS_CLIENT_ID=com.yourcompany.worklenz.mobile
APPLE_ANDROID_CLIENT_ID=com.yourcompany.worklenz.mobile.android
```

### 4. Build & Start (1 min)
```bash
npm run build:prod
npm start
```

### 5. Test (30 sec)
```bash
curl -X POST http://localhost:3000/auth/apple/mobile \
  -H "Content-Type: application/json" \
  -d '{"idToken": "test"}'

# Should return: 400 "Invalid Apple ID token format"
```

---

## 📱 iOS Integration (5 min)

```swift
import AuthenticationServices

// 1. Trigger Apple Sign-In
let provider = ASAuthorizationAppleIDProvider()
let request = provider.createRequest()
request.requestedScopes = [.fullName, .email]

let controller = ASAuthorizationController(authorizationRequests: [request])
controller.delegate = self
controller.performRequests()

// 2. Get ID Token
func authorizationController(controller: ASAuthorizationController, 
                            didCompleteWithAuthorization authorization: ASAuthorization) {
    guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
          let tokenData = credential.identityToken,
          let token = String(data: tokenData, encoding: .utf8) else { return }
    
    // 3. Send to Backend
    sendToBackend(idToken: token)
}

// 4. Authenticate
func sendToBackend(idToken: String) {
    let url = URL(string: "https://api.worklenz.com/auth/apple/mobile")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try? JSONSerialization.data(withJSONObject: [
        "idToken": idToken,
        "timezone": TimeZone.current.identifier
    ])
    
    URLSession.shared.dataTask(with: request) { data, response, error in
        // Handle response
    }.resume()
}
```

---

## 🔧 API Reference

### Endpoint
```
POST /auth/apple/mobile
```

### Request
```json
{
  "idToken": "eyJraWQiOiJXNldjT0tCIiwiYWxnIjoiUlMyNTYifQ...",
  "timezone": "America/New_York"
}
```

### Success Response (200)
```json
{
  "done": true,
  "message": "User successfully logged in",
  "user": {
    "id": "uuid",
    "name": "Apple User",
    "email": "user@example.com",
    "active_team": "team-uuid",
    "setup_completed": false
  },
  "authenticated": true,
  "sessionId": "session-id",
  "sessionName": "worklenz.sid"
}
```

### Error Responses
| Code | Message |
|------|---------|
| 400 | "Apple ID token is required" |
| 400 | "Invalid Apple ID token" |
| 400 | "Apple ID token has expired" |
| 400 | "Account already exists..." |
| 500 | "Authentication failed" |

---

## 🐛 Common Issues

### "No Apple client IDs configured"
**Fix**: Add to `.env`:
```bash
APPLE_IOS_CLIENT_ID=com.yourcompany.worklenz.mobile
```

### "Invalid Apple ID token"
**Fix**: 
- Check Bundle ID matches `APPLE_IOS_CLIENT_ID`
- Ensure token is fresh (< 10 minutes)
- Verify Apple Developer Portal setup

### "Function register_apple_user does not exist"
**Fix**: Run migration:
```bash
psql -U postgres -d worklenz_bz_db -f database/migrations/20251112000002-add-register-apple-user-function.sql
```

---

## ✅ Verification Checklist

- [ ] `npm install` completed
- [ ] Both migrations executed
- [ ] `.env` configured with Apple IDs
- [ ] Server builds without errors
- [ ] Test endpoint returns 400 (expected)
- [ ] iOS app can authenticate

---

## 📚 Full Documentation

- **Implementation Guide**: `docs/APPLE_SIGN_IN_IMPLEMENTATION_GUIDE.md`
- **Architecture Plan**: `docs/APPLE_SIGN_IN_IMPLEMENTATION_PLAN.md`
- **Summary**: `docs/APPLE_SIGN_IN_SUMMARY.md`

---

## 🎯 What's Included

✅ Database schema changes  
✅ JWT token verification  
✅ User registration/login  
✅ Session management  
✅ Account conflict prevention  
✅ Email privacy handling  
✅ Comprehensive error handling  
✅ iOS integration example  

---

**Ready to deploy in 5 minutes!** 🚀
