# Account Setup Project Members Fix

## Overview
This migration fixes an issue where team members invited during the account setup process were only added to the team but not to the newly created project. This meant invited members could see the team but couldn't access the project.

## Problem Statement
**Before this fix:**
1. User completes account setup and invites team members
2. Team members are added to the team via `create_team_member` function
3. A project is created during setup
4. **Issue**: Invited team members are NOT added as project members
5. Result: Invited members can't access the project created during setup

## Solution
**After this fix:**
1. User completes account setup and invites team members
2. Team members are added to the team via `create_team_member` function
3. A project is created during setup
4. **New**: Each invited team member is automatically added to the project via `create_project_member` function
5. Result: Invited members have immediate access to the project with MEMBER access level

## Changes Made

### 1. Database Migration
**File**: `20260224000000-add-project-members-to-account-setup.sql`

**Function Modified**: `complete_account_setup(_user_id uuid, _team_id uuid, _body json)`

**Key Changes**:
- Added new variables:
  - `_member JSON` - to iterate through invited members
  - `_invited_team_member_id UUID` - to store each member's ID
  - `_project_member_result JSON` - to capture project member creation result

- Added new logic after team member creation:
  ```sql
  -- NEW: Add each invited team member to the project as well
  IF _members IS NOT NULL
  THEN
      FOR _member IN SELECT * FROM JSON_ARRAY_ELEMENTS(_members)
      LOOP
          _invited_team_member_id = (_member ->> 'team_member_id')::UUID;
          
          IF _invited_team_member_id IS NOT NULL
          THEN
              -- Add to project with MEMBER access level
              SELECT create_project_member(JSON_BUILD_OBJECT(
                  'team_member_id', _invited_team_member_id,
                  'team_id', _team_id,
                  'project_id', _project_id,
                  'user_id', _user_id,
                  'access_level', 'MEMBER'
              )) INTO _project_member_result;
          END IF;
      END LOOP;
  END IF;
  ```

### 2. Backend Controller Update
**File**: `worklenz-backend/src/controllers/profile-settings-controller.ts`

**Changes**:
- Updated `sendTeamMembersInvitations` call to include project ID:
  ```typescript
  NotificationsService.sendTeamMembersInvitations(
    newMembers, 
    req.user as IPassportSession,
    data.account.id  // Pass project_id so invitation emails include project link
  );
  ```

## Impact Analysis

### Functions Called
1. **`create_team_member`** - Existing function, no changes
   - Creates team-level membership
   - Returns array of created members with their IDs

2. **`create_project_member`** - Existing function, no changes
   - Creates project-level membership
   - Sends notifications to invited members
   - Returns project member details

### Tables Affected
1. **`team_members`** - No schema changes
   - Existing behavior: Members added during account setup
   - New behavior: Same as before

2. **`project_members`** - No schema changes
   - Existing behavior: Only account owner added to project
   - New behavior: Invited members also added to project

3. **`email_invitations`** - No schema changes
   - Existing behavior: Invitations sent to team members
   - New behavior: Same, but now includes project access

### Notifications
- Invited members will now receive:
  1. Team invitation email (existing)
  2. Project member notification (new)
  3. Email invitation with project link (enhanced)

## Testing Checklist

### Before Migration
- [ ] Backup database
- [ ] Test current account setup flow
- [ ] Document current behavior

### After Migration
- [ ] Run migration successfully
- [ ] Test account setup with team member invitations
- [ ] Verify invited members appear in project members list
- [ ] Verify invited members can access the project
- [ ] Verify notifications are sent correctly
- [ ] Test with 0 invited members (should work as before)
- [ ] Test with multiple invited members
- [ ] Verify existing projects are not affected

### Edge Cases
- [ ] Test with invalid email addresses
- [ ] Test with duplicate email addresses
- [ ] Test with users who already exist in the system
- [ ] Test account setup without inviting any members

## Rollback Plan
If issues occur, rollback by restoring the previous version of `complete_account_setup`:

```sql
-- Restore original function without project member addition
-- (Use the version from 4_functions.sql before this migration)
```

## Dependencies
- Requires `create_project_member` function to exist (already present)
- Requires `create_team_member` function to exist (already present)
- Requires `project_access_levels` table with 'MEMBER' key (already present)

## Notes
- Invited members are added with 'MEMBER' access level (not PROJECT_MANAGER)
- Account owner remains as PROJECT_MANAGER
- This change only affects new account setups, not existing projects
- The function maintains backward compatibility - if no team members are invited, behavior is unchanged
