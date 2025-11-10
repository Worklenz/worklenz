# Invitation Redirect Implementation

## Overview
This implementation fixes the issue where users who click on team/project invitation links while not logged in lose the invitation context after logging in.

## Problem Statement
**Before Fix:**
1. User clicks invitation link → `/invite/team/:token` or `/invite/project/:token`
2. Page loads, makes API call to validate invitation
3. API returns 401 (not authenticated)
4. API interceptor redirects to `/auth/login`
5. User logs in → redirected to default location (home/projects)
6. ❌ **Invitation context is lost** - user never joins the team/project

## Solution Architecture

### Flow After Fix:
1. User clicks invitation link → `/invite/team/:token` or `/invite/project/:token`
2. **Invite page immediately stores token in sessionStorage** (before API call)
3. Page makes API call to validate invitation
4. API returns 401 (not authenticated)
5. **API interceptor detects invite page and stores context** (backup)
6. API interceptor redirects to `/auth/login`
7. User logs in → redirected to `/auth/authenticating`
8. **AuthenticatingPage checks for pending invitation**
9. ✅ **Redirects back to invitation page** → `/invite/team/:token`
10. Now authenticated, user can successfully join team/project
11. After successful join, invitation context is cleared

## Implementation Details

### 1. Invitation Redirect Service (`invitation-redirect.service.ts`)
**Purpose:** Centralized service for managing invitation context in sessionStorage

**Key Methods:**
- `storePendingInvitation(token, type, url)` - Store invitation context
- `getPendingInvitation()` - Retrieve stored invitation
- `hasPendingInvitation()` - Check if invitation exists
- `clearPendingInvitation()` - Clear stored invitation
- `buildInvitationUrl(token, type)` - Build invitation URL

**Storage Keys:**
- `worklenz_pending_invitation_token` - The invitation token
- `worklenz_pending_invitation_type` - Type: 'team' or 'project'
- `worklenz_pending_invitation_url` - Full URL path

### 2. API Client Interceptor (`api-client.ts`)
**Changes:**
- Added import for `invitationRedirectService`
- Enhanced 401 error handler to detect invite pages
- Stores invitation context before redirecting to login
- Uses regex to extract token from URL path

**Code:**
```typescript
// Check if we're on an invite page and preserve the context
const currentPath = window.location.pathname;
const teamInviteMatch = currentPath.match(/^\/invite\/team\/([^/]+)$/);
const projectInviteMatch = currentPath.match(/^\/invite\/project\/([^/]+)$/);

if (teamInviteMatch) {
  const token = teamInviteMatch[1];
  invitationRedirectService.storePendingInvitation(token, 'team', currentPath);
}
```

### 3. Team Invite Page (`TeamInvitePage.tsx`)
**Changes:**
- Added import for `invitationRedirectService`
- Stores invitation context immediately in `useEffect` (before API call)
- Clears invitation context after successful join
- Added console logs for debugging

**Key Points:**
- Storage happens **before** `validateInvitation()` API call
- This ensures context is preserved even if 401 happens immediately
- Context is cleared only after successful join

### 4. Project Invite Page (`ProjectInvitePage.tsx`)
**Changes:** Same as TeamInvitePage but for project invitations

### 5. Authenticating Page (`AuthenticatingPage.tsx`)
**Changes:**
- Added import for `invitationRedirectService`
- Enhanced `handleSuccessRedirect()` to check for pending invitations
- Invitation redirect has **highest priority** over other redirects

**Priority Order:**
1. Pending invitation (highest)
2. Project redirect (`WORKLENZ_REDIRECT_PROJ_KEY`)
3. Default home page (lowest)

## Testing Scenarios

### Scenario 1: Non-authenticated User with Team Invitation
**Steps:**
1. Logout from Worklenz
2. Click team invitation link: `/invite/team/abc123`
3. Observe: Automatically redirected to `/auth/login`
4. Login with valid credentials
5. **Expected:** Redirected back to `/invite/team/abc123`
6. **Expected:** Form pre-filled with user details
7. Click "Join Team"
8. **Expected:** Successfully joined team, redirected to projects

### Scenario 2: Non-authenticated User with Project Invitation
**Steps:**
1. Logout from Worklenz
2. Click project invitation link: `/invite/project/xyz789`
3. Observe: Automatically redirected to `/auth/login`
4. Login with valid credentials
5. **Expected:** Redirected back to `/invite/project/xyz789`
6. **Expected:** Form pre-filled with user details
7. Click "Join Project"
8. **Expected:** Successfully joined project, redirected to project page

### Scenario 3: Already Authenticated User
**Steps:**
1. Login to Worklenz
2. Click invitation link
3. **Expected:** No redirect, form pre-filled immediately
4. Click "Join Team/Project"
5. **Expected:** Successfully joined

### Scenario 4: Invalid/Expired Token
**Steps:**
1. Logout from Worklenz
2. Click invitation link with invalid token
3. Login
4. **Expected:** Redirected to invite page
5. **Expected:** Error message shown (invalid/expired)
6. Invitation context should be cleared

### Scenario 5: Already a Member
**Steps:**
1. User already member of team/project
2. Click invitation link
3. Login (if needed)
4. **Expected:** Error message "Already a member"
5. Invitation context should be cleared

## Edge Cases Handled

### 1. Multiple Invitation Attempts
- Only the most recent invitation is stored
- Previous invitation context is overwritten

### 2. Browser Refresh on Login Page
- Invitation context persists in sessionStorage
- User can refresh and still complete the flow

### 3. Session Expiry During Invitation
- If session expires while on invite page
- 401 handler preserves context again
- User can re-login and continue

### 4. Direct Navigation After Login
- If user manually navigates away after login
- Invitation context remains until explicitly cleared
- Next login will still redirect to invitation

### 5. SessionStorage Unavailable
- Service has try-catch blocks
- Gracefully handles storage errors
- Logs errors to console

## Security Considerations

### 1. Token Validation
- Tokens are always validated on backend
- Frontend only stores the token temporarily
- No sensitive data in sessionStorage

### 2. Session-based Storage
- Uses sessionStorage (not localStorage)
- Cleared when browser tab/window closes
- Not shared across tabs

### 3. Backend Validation
- Backend checks:
  - Token validity and expiration
  - User authentication status
  - Subscription limits
  - Duplicate membership
  - Email verification

### 4. CSRF Protection
- All API calls include CSRF token
- Invitation acceptance requires valid session

## Debugging

### Console Logs Added
- `[InvitationRedirect] Stored pending {type} invitation: {token}`
- `[InvitationRedirect] Retrieved pending {type} invitation: {token}`
- `[InvitationRedirect] Cleared pending invitation`
- `[API] Stored {type} invitation context before 401 redirect`
- `[TeamInvite] Stored invitation context on mount`
- `[ProjectInvite] Stored invitation context on mount`
- `[Authenticating] Found pending invitation, redirecting to: {url}`

### How to Debug
1. Open browser DevTools → Console
2. Look for `[InvitationRedirect]`, `[API]`, `[TeamInvite]`, `[ProjectInvite]`, `[Authenticating]` logs
3. Check sessionStorage: `Application → Storage → Session Storage`
4. Look for keys: `worklenz_pending_invitation_*`

### Common Issues

**Issue:** Invitation context not stored
- Check console for errors
- Verify sessionStorage is enabled
- Check if token is extracted correctly from URL

**Issue:** Not redirected after login
- Check if `AuthenticatingPage` is called
- Verify `getPendingInvitation()` returns data
- Check console for redirect logs

**Issue:** Redirected but still shows login form
- Backend might be returning 401 again
- Check if session was properly created
- Verify cookies are being sent

## Files Modified

1. ✅ `worklenz-frontend/src/services/invitation-redirect.service.ts` (NEW)
2. ✅ `worklenz-frontend/src/api/api-client.ts`
3. ✅ `worklenz-frontend/src/pages/invite/team/TeamInvitePage.tsx`
4. ✅ `worklenz-frontend/src/pages/invite/project/ProjectInvitePage.tsx`
5. ✅ `worklenz-frontend/src/pages/auth/AuthenticatingPage.tsx`

## Backend Compatibility

**No backend changes required!**

The backend already supports both authenticated and non-authenticated invitation acceptance:
- `acceptTeamInvitationByLink` checks `req.user?.id`
- `acceptProjectInvitationByLink` checks `req.user?.id`
- Both methods handle user creation/linking appropriately

## Performance Impact

**Minimal:**
- sessionStorage operations are synchronous and fast
- No additional API calls
- Regex matching is efficient
- Service is a singleton (no re-instantiation)

## Browser Compatibility

**Supported:**
- All modern browsers (Chrome, Firefox, Safari, Edge)
- Requires sessionStorage support (available since IE8+)

## Future Enhancements

1. **Add expiration to stored invitations**
   - Clear context after X minutes
   - Prevent stale invitations

2. **Support multiple pending invitations**
   - Store array of invitations
   - Let user choose which to accept

3. **Add analytics tracking**
   - Track invitation conversion rate
   - Monitor redirect success rate

4. **Improve error handling**
   - Show specific error messages
   - Retry mechanism for failed joins

5. **Add loading states**
   - Show spinner during redirect
   - Better UX feedback

## Rollback Plan

If issues occur, revert these commits:
1. Remove `invitation-redirect.service.ts`
2. Revert changes to `api-client.ts`
3. Revert changes to invite pages
4. Revert changes to `AuthenticatingPage.tsx`

The system will work as before (without post-login redirect).

---

**Implementation Date:** 2025-11-10
**Status:** ✅ Complete
**Tested:** Pending user testing
