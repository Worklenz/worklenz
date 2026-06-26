# Business Plan Override & AppSumo Implementation Summary

**Date:** March 16, 2026  
**Status:** ✅ Implementation Complete

## Overview

Implemented a comprehensive business plan access control system with:
1. **Manual override flags** for business plan features and team member limits
2. **Automatic business plan access** for AppSumo lifetime deal users with 5+ redeemed codes
3. **Consistent enforcement** across all team/project member addition flows

---

## Database Changes

### Migration File
**Location:** `worklenz-backend/database/migrations/release-v2.5/20260316000000-add-business-plan-overrides.sql`

```sql
-- Add two new columns to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS business_plan_override BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS team_member_limit_override BOOLEAN DEFAULT FALSE NOT NULL;

-- Create partial indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_business_override 
ON organizations(business_plan_override) WHERE business_plan_override = TRUE;

CREATE INDEX IF NOT EXISTS idx_organizations_member_limit_override 
ON organizations(team_member_limit_override) WHERE team_member_limit_override = TRUE;
```

### Updated Functions

**`deserialize_user(_id uuid)`** - Updated to include override flags in session data
- Added `business_plan_override` and `team_member_limit_override` to `team_org_data` CTE
- Matched production structure with `plan_trial_data` CTE for plan trials
- Flags now available in user session throughout the application

---

## Backend Changes

### 1. Subscription Data Query (`paddle-utils.ts`)

**Function:** `checkTeamSubscriptionStatus(team_id: string)`

**Changes:**
- Added `business_plan_override` and `team_member_limit_override` to SELECT query
- Added `redeemed_codes_count` - counts all redeemed coupon codes
- Added logic to set `appsumo_business_eligible = true` when user has 5+ codes and is LTD user

```typescript
// Check if AppSumo LTD user with 5+ redeemed codes should get business plan access
if (data && data.redeemed_codes_count >= 5 && data.is_ltd) {
  data.appsumo_business_eligible = true;
}
```

### 2. Business Plan Access Control (`subscription-middleware.ts`)

**Function:** `hasBusinessPlanAccess(user: any)`

**Priority Order:**
1. **Manual override** (`business_plan_override = true`) - Highest priority
2. **AppSumo eligibility** (`appsumo_business_eligible = true`) - 5+ codes
3. **Active Business plan trial** (BUSINESS_LARGE tier)
4. **BUSINESS_TRIAL** subscription type
5. **ANNUAL_BUSINESS** subscription type
6. **SELF_HOSTED** users
7. **PADDLE** users with business/enterprise plans

### 3. Team Member Limit Checks

**Updated Files:**
- `team-members-controller.ts` - 7 locations
- `project-members-controller.ts` - 3 locations

**Pattern Applied:**

```typescript
// Skip all limit checks if team_member_limit_override is enabled
if (subscriptionData.team_member_limit_override !== true) {
  // Existing limit checks:
  // - Trial limit (10 members)
  // - Subscription seat limits
  // - LTD limits (unless business plan)
}

// For business plan checks (LTD bypass):
const isBusinessPlan = 
  subscriptionData.subscription_type === 'ANNUAL_BUSINESS' ||
  subscriptionData.plan_name?.toLowerCase().includes("business") ||
  subscriptionData.business_plan_override === true ||
  subscriptionData.appsumo_business_eligible === true;
```

**Locations Updated in `team-members-controller.ts`:**
1. `create()` - Line ~177 (main limit check wrapper)
2. `create()` - Line ~214 (isBusinessPlan definition)
3. `acceptInvitation()` - Line ~1379 (reactivation check)
4. `acceptInvitation()` - Line ~1413 (isBusinessPlan definition)
5. `reactivate()` - Line ~1492 (reactivation check)
6. `reactivate()` - Line ~1526 (isBusinessPlan definition)
7. `inviteByLink()` - Line ~1619 (trial limit check)
8. `generateTeamInvitationLink()` - Line ~1773 (isBusinessPlan definition)
9. `acceptInvitationByLink()` - Line ~2082 (isBusinessPlan definition)
10. `acceptInvitationByLink()` - Line ~2111 (trial limit check)

**Locations Updated in `project-members-controller.ts`:**
1. `create()` - Line ~183 (trial limit check)
2. `create()` - Line ~192 (main limit check wrapper)
3. `create()` - Line ~213 (isBusinessPlan definition)
4. `generateInvitationLink()` - Line ~350 (limit check wrapper)
5. `generateInvitationLink()` - Line ~353 (isBusinessPlan definition)
6. `inviteByLink()` - Line ~614 (limit check wrapper)
7. `inviteByLink()` - Line ~632 (isBusinessPlan definition)

---

## Frontend Changes

### 1. TypeScript Interface (`local-session.types.ts`)

**Added Fields:**
```typescript
export interface ILocalSession extends IUserType {
  // ... existing fields
  
  // Manual override flags
  business_plan_override?: boolean;
  team_member_limit_override?: boolean;
  
  // AppSumo eligibility
  appsumo_business_eligible?: boolean;
  redeemed_codes_count?: number;
}
```

### 2. Subscription Utilities (`subscription-utils.ts`)

**Updated Functions:**
- `hasBusinessFeatureAccess(session: ILocalSession | null)`
- `isBusinessPlan(session: ILocalSession | null)`

**Priority Order (same as backend):**
1. Manual `business_plan_override` flag
2. AppSumo eligibility (5+ codes)
3. Active Business plan trial
4. Existing subscription logic

---

## Manual Management

### Enable Override Flags

```sql
-- Find organization by user email
SELECT o.id, o.organization_name, u.email, 
       o.business_plan_override, o.team_member_limit_override
FROM organizations o
JOIN users u ON u.id = o.user_id
WHERE u.email = 'user@example.com';

-- Enable business plan features only
UPDATE organizations 
SET business_plan_override = TRUE 
WHERE id = 'organization-uuid';

-- Enable unlimited team members only
UPDATE organizations 
SET team_member_limit_override = TRUE 
WHERE id = 'organization-uuid';

-- Enable both
UPDATE organizations 
SET business_plan_override = TRUE,
    team_member_limit_override = TRUE 
WHERE id = 'organization-uuid';
```

### Check AppSumo Eligibility

```sql
-- Check which users qualify for automatic business plan access
SELECT 
  u.email,
  o.organization_name,
  COUNT(lcc.id) AS redeemed_codes,
  CASE WHEN COUNT(lcc.id) >= 5 THEN 'YES - Auto Business Access' ELSE 'NO' END AS business_eligible
FROM users u
JOIN organizations o ON o.user_id = u.id
LEFT JOIN licensing_coupon_codes lcc 
  ON lcc.redeemed_by = u.id AND lcc.is_redeemed = TRUE
WHERE u.email = 'user@example.com'
GROUP BY u.email, o.organization_name;
```

### Audit Queries

```sql
-- Organizations with manual overrides
SELECT 
  o.organization_name,
  u.email,
  o.business_plan_override,
  o.team_member_limit_override,
  o.subscription_status,
  o.license_type_id
FROM organizations o
JOIN users u ON u.id = o.user_id
WHERE o.business_plan_override = TRUE 
   OR o.team_member_limit_override = TRUE
ORDER BY o.organization_name;

-- AppSumo users with 5+ codes (auto business access)
SELECT 
  u.email,
  o.organization_name,
  COUNT(lcc.id) AS redeemed_codes,
  SUM(lcc.team_members_limit) AS total_member_limit
FROM users u
JOIN organizations o ON o.user_id = u.id
LEFT JOIN licensing_coupon_codes lcc 
  ON lcc.redeemed_by = u.id AND lcc.is_redeemed = TRUE
GROUP BY u.email, o.organization_name
HAVING COUNT(lcc.id) >= 5
ORDER BY redeemed_codes DESC;
```

---

## Access Control Logic

### Business Plan Feature Access

**Features Controlled:**
- Client Portal access
- Slack integration
- Organization logo upload/delete
- Project finance features
- Other business-tier features

**Access Granted When:**
1. `business_plan_override = TRUE` (manual), OR
2. `appsumo_business_eligible = TRUE` (5+ codes), OR
3. Active Business plan trial, OR
4. ANNUAL_BUSINESS subscription, OR
5. SELF_HOSTED user, OR
6. PADDLE subscription with business/enterprise plan

### Team Member Limit Control

**Limits Bypassed When:**
- `team_member_limit_override = TRUE` - **All limits bypassed** (unlimited members)

**Limits Applied When Override is FALSE:**
- **Trial users:** Max 10 members
- **LTD users:** Limited by `SUM(team_members_limit)` from redeemed codes
  - **Exception:** Business plan users bypass LTD limits
- **Active subscriptions:** Limited by subscription seat count

---

## Testing Checklist

### Manual Override Testing
- [x] Set `business_plan_override = TRUE` - verify business feature access
- [x] Set `team_member_limit_override = TRUE` - verify unlimited member additions
- [x] Verify flags persist across login/logout
- [x] Verify flags propagate to all team members

### AppSumo 5+ Codes Testing
- [x] User with 4 codes - NO business access
- [x] User with 5+ codes - YES business access
- [x] Verify `appsumo_business_eligible` flag in session
- [x] Verify business features accessible

### Team Member Addition Testing
- [x] Add member with `business_plan_override = TRUE`
- [x] Add member with `team_member_limit_override = TRUE`
- [x] Add member with AppSumo 5+ codes
- [x] Verify trial limit bypass with override
- [x] Verify LTD limit bypass with business plan
- [x] Verify subscription seat limit bypass with override

### Integration Testing
- [x] Team member invitation by email
- [x] Team member invitation by link
- [x] Project member addition
- [x] Project member invitation by link
- [x] Member reactivation
- [x] All flows respect override flags

---

## Deployment Steps

1. **Run Database Migration**
   ```bash
   psql -U cdsadmin -d worklenz_db -f worklenz-backend/database/migrations/release-v2.5/20260316000000-add-business-plan-overrides.sql
   ```

2. **Update `deserialize_user` Function**
   ```bash
   psql -U cdsadmin -d worklenz_db -f worklenz-backend/database/sql/4_functions.sql
   ```

3. **Deploy Backend**
   - Backend changes are backward compatible
   - New flags default to FALSE (no behavior change for existing users)

4. **Deploy Frontend**
   - Frontend changes are backward compatible
   - New fields are optional in TypeScript interfaces

5. **Verify Deployment**
   ```sql
   -- Check columns exist
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns 
   WHERE table_name = 'organizations' 
   AND column_name IN ('business_plan_override', 'team_member_limit_override');
   
   -- Check indexes exist
   SELECT indexname FROM pg_indexes 
   WHERE tablename = 'organizations' 
   AND indexname LIKE '%override%';
   ```

---

## Key Implementation Details

### Why Two Separate Flags?

1. **`business_plan_override`** - Controls **feature access**
   - Client portal, Slack, finance, etc.
   - Does NOT bypass team member limits
   - Use when: Customer needs business features but not unlimited members

2. **`team_member_limit_override`** - Controls **member limits**
   - Bypasses ALL limits (trial, LTD, subscription)
   - Does NOT grant business features
   - Use when: Customer needs more members but not business features

3. **Both flags enabled** - Full business plan equivalent
   - Business features + unlimited members
   - Use when: Full manual override needed

### AppSumo 5+ Codes Logic

- **Automatic:** No manual intervention needed
- **Counts ALL redeemed codes:** Not just AppSumo-specific ones
- **Requires LTD flag:** Must be `is_ltd = TRUE`
- **Grants business features:** Same as `business_plan_override`
- **Does NOT bypass member limits:** Still respects LTD member limits unless business plan override is also enabled

### Business Plan Bypass of LTD Limits

**Existing behavior preserved:**
- Users with business plan access (any method) bypass LTD limits
- This includes: ANNUAL_BUSINESS, PADDLE business/enterprise, trials, overrides, AppSumo 5+
- They still respect subscription seat limits (unless `team_member_limit_override = TRUE`)

---

## Files Modified

### Backend (8 files)
1. `database/migrations/release-v2.5/20260316000000-add-business-plan-overrides.sql` ✨ NEW
2. `database/sql/4_functions.sql` - `deserialize_user` function
3. `src/shared/paddle-utils.ts` - `checkTeamSubscriptionStatus` function
4. `src/middlewares/subscription-middleware.ts` - `hasBusinessPlanAccess` function
5. `src/controllers/team-members-controller.ts` - 10 locations
6. `src/controllers/project-members-controller.ts` - 7 locations

### Frontend (2 files)
7. `src/types/auth/local-session.types.ts` - Interface updates
8. `src/utils/subscription-utils.ts` - Utility function updates

---

## Support & Troubleshooting

### User Not Getting Business Access

**Check:**
1. Is `business_plan_override = TRUE`? 
2. Do they have 5+ redeemed codes AND `is_ltd = TRUE`?
3. Is their session data refreshed? (logout/login)
4. Check `deserialize_user` function output

### User Can't Add Team Members

**Check:**
1. Is `team_member_limit_override = TRUE`?
2. Are they on a business plan (bypasses LTD limits)?
3. Do they have available subscription seats?
4. Are they a trial user exceeding 10 members?

### Override Not Working

**Verify:**
```sql
-- Check user's current session data
SELECT deserialize_user('user-uuid-here');

-- Should include:
-- "business_plan_override": true/false
-- "team_member_limit_override": true/false
-- "appsumo_business_eligible": true/false (if applicable)
-- "redeemed_codes_count": number
```

---

## Future Enhancements

### Potential Additions
1. **Admin UI** - Interface to manage override flags
2. **Audit logging** - Track when overrides are enabled/disabled
3. **Time-based overrides** - Auto-expire after certain date
4. **Granular feature flags** - Individual feature overrides
5. **API endpoints** - Programmatic override management

### Monitoring Recommendations
- Track organizations with overrides enabled
- Alert on long-running overrides without notes
- Monitor AppSumo users reaching 5+ codes threshold
- Track team member additions for override-enabled orgs

---

## Summary

✅ **Implementation Complete**

- Database migration created with override flags
- Backend logic updated across all member addition flows
- Frontend interfaces and utilities updated
- Access control follows clear priority hierarchy
- Manual management via SQL queries
- Backward compatible deployment
- Comprehensive testing coverage

**Next Steps:**
1. Review and approve implementation
2. Test in staging environment
3. Run database migration in production
4. Deploy backend and frontend
5. Monitor for issues
6. Document for support team
