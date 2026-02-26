# Invitation Email Fix - Team Switching for Existing Users

## Problem Summary

When an existing logged-in user clicked an invitation email link, they were not switched to the invited team and not redirected to the project. New user signups worked correctly.

**Example invitation link:**
```
http://localhost:5173/auth/login?team=1b32f473-df52-4b61-a831-5e37bd3f61a2&user=8c6df120-2b73-40c2-aca3-d1241ce30a29&project=b09d1ca6-da16-4360-b7e9-3834efe1beba
```

## Root Causes

### 1. LoginPage Not Extracting Invitation Parameters
**File:** `worklenz-frontend/src/pages/auth/LoginPage.tsx`

The LoginPage had unused `urlParams` state variables but never extracted the `team`, `user`, and `project` query parameters from the URL. Unlike SignupPage which correctly extracted these parameters, LoginPage ignored them completely.

### 2. Race Condition in Invite Pages
**Files:** 
- `worklenz-frontend/src/pages/invite/team/TeamInvitePage.tsx`
- `worklenz-frontend/src/pages/invite/project/ProjectInvitePage.tsx`

When a logged-in user accepted an invitation, the code called `dispatch(setActiveTeam(teamId))` (an async Redux action) but immediately redirected with `window.location.href` without waiting for the Redux state to update. This caused the redirect to happen before the team switch completed.

### 3. Backend Sets Active Team, But Frontend Doesn't Wait
The backend correctly called `SELECT set_active_team($1, $2)` to update the database, but the frontend didn't wait for this operation to complete before redirecting.

## Solution Implemented

### Fix 1: Extract Invitation Parameters in LoginPage
**File:** `worklenz-frontend/src/pages/auth/LoginPage.tsx`

Added a `useEffect` hook to extract invitation parameters from URL query string:

```typescript
useEffect(() => {
  const searchParams = new URLSearchParams(window.location.search);
  const teamId = searchParams.get('team') || '';
  const userId = searchParams.get('user') || '';
  const projectId = searchParams.get('project') || '';

  if (teamId || userId || projectId) {
    console.log('[LoginPage] Found invitation parameters:', { teamId, userId, projectId });
    setUrlParams({ teamId, userId, projectId });
    
    // Store project ID for redirect after login
    if (projectId) {
      localStorage.setItem(WORKLENZ_REDIRECT_PROJ_KEY, projectId);
    }
  }
}, []);
```

### Fix 2: Handle Already Logged-In Users with Invitation Links
**File:** `worklenz-frontend/src/pages/auth/LoginPage.tsx`

For already logged-in users who click invitation links, attempt to switch to the invited team. If successful (user is already a member), redirect to project. If failed (user is not a member yet), redirect to home with message. Uses `useRef` to prevent infinite loops:

```typescript
// Use ref to prevent multiple executions of auth check
const hasCheckedAuth = useRef(false);

useEffect(() => {
  // Prevent multiple executions
  if (hasCheckedAuth.current) {
    return;
  }
  hasCheckedAuth.current = true;

  // Extract invitation parameters and check auth
  const searchParams = new URLSearchParams(window.location.search);
  const teamId = searchParams.get('team') || '';
  const projectId = searchParams.get('project') || '';

  const checkAuth = async () => {
    const session = await dispatch(verifyAuthentication()).unwrap();

    if (session?.authenticated) {
      if (teamId && projectId) {
        // Try to switch to the invited team
        try {
          await dispatch(setActiveTeam(teamId)).unwrap();
          console.log('[LoginPage] Successfully switched to invited team');
          
          // User is already a member, redirect to project
          window.location.href = `/worklenz/projects/${projectId}`;
        } catch (error) {
          console.error('[LoginPage] Could not switch team - user is not a member yet');
          
          // User is not a member yet, show message and redirect to home
          message.info('Please check your notifications to accept the team invitation.');
          
          setTimeout(() => {
            window.location.href = '/worklenz/home';
          }, 2000);
        }
      } else {
        window.location.href = '/worklenz/home';
      }
    }
  };
  
  void checkAuth();
}, []); // Empty dependency array - only run once on mount
```

**Why this approach:**
- Attempts to switch teams using `setActiveTeam()` API
- If successful → user is already a member → redirect to project ✅
- If fails → user is not a member yet → show message and redirect to home ✅
- Uses `useRef` to prevent infinite loops
- Empty dependency array ensures effect only runs once
- Handles both scenarios appropriately

### Fix 3: Pass Invitation Parameters to Backend During Login
**File:** `worklenz-frontend/src/pages/auth/LoginPage.tsx`

Updated the `onFinish` callback to include invitation parameters in the login request:

```typescript
const normalizedValues = {
  ...values,
  email: values.email.toLowerCase().trim(),
  // Include invitation parameters in login request
  team_id: urlParams.teamId || undefined,
  team_member_id: urlParams.userId || undefined,
  project_id: urlParams.projectId || undefined,
};
```

### Fix 3: Pass Invitation Parameters to Backend During Login
**File:** `worklenz-frontend/src/pages/auth/LoginPage.tsx`

Updated the `onFinish` callback to include invitation parameters in the login request:

```typescript
const normalizedValues = {
  ...values,
  email: values.email.toLowerCase().trim(),
  // Include invitation parameters in login request
  team_id: urlParams.teamId || undefined,
  team_member_id: urlParams.userId || undefined,
  project_id: urlParams.projectId || undefined,
};
```

### Fix 4: Set Active Team During Login (Backend)
**File:** `worklenz-backend/src/passport/passport-strategies/passport-local-login.ts`

Modified the login strategy to set the active team when invitation parameters are present:

```typescript
if (passwordMatch) {
  delete data.password;
  
  // Handle invitation parameters if present
  const { team_id, team_member_id, project_id } = req.body;
  
  if (team_id) {
    try {
      // Set the invited team as active for the user
      const setActiveTeamQuery = `SELECT set_active_team($1, $2)`;
      await db.query(setActiveTeamQuery, [data.id, team_id]);
      console.log(`[Login] Set active team ${team_id} for user ${data.id}`);
      
      // Store invitation info in session for redirect after login
      (req.session as any).invitationRedirect = {
        teamId: team_id,
        teamMemberId: team_member_id,
        projectId: project_id
      };
    } catch (error) {
      console.error('[Login] Failed to set active team:', error);
      log_error(error, { userId: data.id, teamId: team_id });
    }
  }
  
  const successMsg = "User successfully logged in";
  req.flash(SUCCESS_KEY, successMsg);
  return done(null, data);
}
```

### Fix 4: Set Active Team During Login (Backend)
**File:** `worklenz-backend/src/passport/passport-strategies/passport-local-login.ts`

Modified the login strategy to set the active team when invitation parameters are present:

```typescript
if (passwordMatch) {
  delete data.password;
  
  // Handle invitation parameters if present
  const { team_id, team_member_id, project_id } = req.body;
  
  if (team_id) {
    try {
      // Set the invited team as active for the user
      const setActiveTeamQuery = `SELECT set_active_team($1, $2)`;
      await db.query(setActiveTeamQuery, [data.id, team_id]);
      console.log(`[Login] Set active team ${team_id} for user ${data.id}`);
      
      // Store invitation info in session for redirect after login
      (req.session as any).invitationRedirect = {
        teamId: team_id,
        teamMemberId: team_member_id,
        projectId: project_id
      };
    } catch (error) {
      console.error('[Login] Failed to set active team:', error);
      log_error(error, { userId: data.id, teamId: team_id });
    }
  }
  
  const successMsg = "User successfully logged in";
  req.flash(SUCCESS_KEY, successMsg);
  return done(null, data);
}
```

### Fix 5: Store Project ID for Post-Login Redirect
**File:** `worklenz-frontend/src/pages/auth/LoginPage.tsx`

The project ID is stored in localStorage before login so that `AuthenticatingPage` can redirect to the correct project:

```typescript
// Store project ID for redirect after login if present
if (urlParams.projectId) {
  localStorage.setItem(WORKLENZ_REDIRECT_PROJ_KEY, urlParams.projectId);
  console.log('[LoginPage] Stored project ID for redirect:', urlParams.projectId);
}
```

### Fix 5: Store Project ID for Post-Login Redirect
**File:** `worklenz-frontend/src/pages/auth/LoginPage.tsx`

The project ID is stored in localStorage before login so that `AuthenticatingPage` can redirect to the correct project:

```typescript
// Store project ID for redirect after login if present
if (urlParams.projectId) {
  localStorage.setItem(WORKLENZ_REDIRECT_PROJ_KEY, urlParams.projectId);
  console.log('[LoginPage] Stored project ID for redirect:', urlParams.projectId);
}
```

### Fix 6: Include Invitation Parameters in OAuth Redirects
**File:** `worklenz-frontend/src/pages/auth/LoginPage.tsx`

Updated Google and Apple login handlers to include invitation parameters:

```typescript
// Include invitation parameters in Google/Apple OAuth redirect
const params = new URLSearchParams();
if (urlParams.teamId) params.append('team', urlParams.teamId);
if (urlParams.userId) params.append('teamMember', urlParams.userId);
if (urlParams.projectId) params.append('project', urlParams.projectId);

const queryString = params.toString();
const url = `${import.meta.env.VITE_API_URL}/secure/google${queryString ? `?${queryString}` : ''}`;
```

### Fix 6: Include Invitation Parameters in OAuth Redirects
**File:** `worklenz-frontend/src/pages/auth/LoginPage.tsx`

Updated Google and Apple login handlers to include invitation parameters:

```typescript
// Include invitation parameters in Google/Apple OAuth redirect
const params = new URLSearchParams();
if (urlParams.teamId) params.append('team', urlParams.teamId);
if (urlParams.userId) params.append('teamMember', urlParams.userId);
if (urlParams.projectId) params.append('project', urlParams.projectId);

const queryString = params.toString();
const url = `${import.meta.env.VITE_API_URL}/secure/google${queryString ? `?${queryString}` : ''}`;
```

### Fix 7: Remove Race Condition in Invite Pages
**Files:**
- `worklenz-frontend/src/pages/invite/team/TeamInvitePage.tsx`
- `worklenz-frontend/src/pages/invite/project/ProjectInvitePage.tsx`

Removed the async `dispatch(setActiveTeam(teamId))` call and rely on the backend's `set_active_team()` database function. The full page reload with `window.location.href` now correctly picks up the updated session:

```typescript
setTimeout(() => {
  if (currentUser && teamId) {
    // Force full page reload to refresh session with new active team
    // Backend has already set the active team, so reload will pick it up
    console.log('[TeamInvite] Reloading to refresh session with new active team:', teamId);
    window.location.href = '/worklenz/projects';
  }
}, 2000);
```

## Files Modified

1. `worklenz-frontend/src/pages/auth/LoginPage.tsx`
   - Added invitation parameter extraction
   - Updated `onFinish` to pass invitation parameters to backend
   - Updated OAuth handlers to include invitation parameters

2. `worklenz-backend/src/passport/passport-strategies/passport-local-login.ts`
   - Added logic to set active team during login when invitation parameters are present
   - Stores invitation info in session for potential future use

3. `worklenz-frontend/src/pages/invite/team/TeamInvitePage.tsx`
   - Removed `dispatch(setActiveTeam())` call
   - Removed unused imports (`useAppDispatch`, `setActiveTeam`)
   - Simplified redirect logic to rely on backend

4. `worklenz-frontend/src/pages/invite/project/ProjectInvitePage.tsx`
   - Removed `dispatch(setActiveTeam())` call
   - Removed unused imports (`useAppDispatch`, `setActiveTeam`)
   - Simplified redirect logic to rely on backend

## Testing Instructions

### Test Case 1: New User Signup via Invitation
1. Test 1 user invites Test 2 (non-existent user) to a team/project
2. Test 2 receives invitation email with link
3. Test 2 clicks link and signs up
4. **Expected:** Test 2 is logged in, active team is set to invited team, redirected to project

### Test Case 2: Existing User (Not Logged In) via Invitation ✅ FIXED
1. Test 1 user invites Test 2 (existing user, not logged in) to a team/project
2. Test 2 receives invitation email with link containing `?team=xxx&user=yyy&project=zzz`
3. Test 2 clicks link and is redirected to login page with parameters
4. Test 2 enters email and password and logs in
5. **Expected:** Backend sets active team to invited team during login, Test 2 is redirected to project with correct team context
6. **How it works:** 
   - LoginPage extracts invitation parameters from URL
   - Passes `team_id`, `team_member_id`, `project_id` to backend in login request
   - Backend's passport-local-login strategy calls `set_active_team()` before completing login
   - User's session is created with correct active team
   - AuthenticatingPage redirects to project using stored project ID

### Test Case 3: Existing User (Already Logged In) via Invitation ✅ FIXED
1. Test 1 user invites Test 2 (existing user, already logged in to different team) to a team/project
2. Test 2 receives invitation email with link containing `?team=xxx&user=yyy&project=zzz`
3. Test 2 clicks link while already logged in
4. **Expected:** 
   - **If Test 2 is already a member** of the invited team → switches to that team and redirects to project ✅
   - **If Test 2 is NOT yet a member** → redirects to home with message to accept invitation from notifications ✅
5. **How it works:**
   - LoginPage detects user is already logged in AND has invitation parameters
   - Attempts to call `setActiveTeam(teamId)` Redux action
   - **If successful** → user is already a team member → redirects to project
   - **If fails** → user needs to accept invitation first → shows message and redirects to home after 2 seconds
   - Uses `useRef` to prevent infinite loops
   - Clean error handling with appropriate user feedback

### Test Case 4: OAuth Login via Invitation
1. Test 1 user invites Test 2 to a team/project
2. Test 2 receives invitation email with link
3. Test 2 clicks link and logs in with Google/Apple
4. **Expected:** Test 2 is logged in, active team is set to invited team, redirected to project

## Technical Notes

- The backend's `set_active_team()` database function is the source of truth for team switching
- Using `window.location.href` for redirect ensures the session is fully refreshed with the new active team
- The `WORKLENZ_REDIRECT_PROJ_KEY` localStorage item is used by `AuthenticatingPage` to redirect to the correct project after login
- Console logs added for debugging invitation flow

## Related Backend Code

The backend correctly handles team activation in:
- `worklenz-backend/src/controllers/team-members-controller.ts` (line 1560-1561)
- `worklenz-backend/src/controllers/project-members-controller.ts` (line 708-709)

Both call:
```sql
SELECT set_active_team($1, $2)
```

This database function updates the user's active team in the session.
