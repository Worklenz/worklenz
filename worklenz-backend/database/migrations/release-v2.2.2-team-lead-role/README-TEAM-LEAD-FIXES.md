# Team Lead Role Fixes - Migration Documentation

## Overview
This set of migrations fixes the critical issue where Team Lead roles were incorrectly granted admin privileges. The new implementation uses a hierarchy-based access control system instead of admin flags.

## Problem Identified
- **Team Lead roles had `admin_role = TRUE`** (same as Admins)
- **Frontend sessions included `is_admin = true`** for Team Leads
- **All existing permission checks worked automatically** for Team Leads because they were treated as admins
- **This violated the intended design** of hierarchy-based management

## Solution Implemented
The new implementation uses **reporting hierarchy** (`reports_to_member_id`) to determine Team Lead permissions instead of admin privileges.

## Migration Files

### 1. `20250922000000-add-reports-to-team-members.sql`
- **Purpose**: Establishes reporting hierarchy foundation
- **Changes**: Adds `reports_to_member_id` column to `team_members` table
- **Impact**: Enables hierarchical management relationships

### 2. `20250922000001-create-team-lead-member-views.sql`
- **Purpose**: Creates views for hierarchy-based Team Lead access
- **Changes**: 
  - `team_lead_managed_members` view (recursive hierarchy)
  - `team_lead_member_stats` view (performance metrics)
  - `team_lead_member_performance` view (individual member stats)
  - `team_lead_time_logs` view (time tracking data)
- **Impact**: Provides data access based on reporting relationships

### 3. `20250922000002-fix-team-lead-admin-privileges.sql`
- **Purpose**: Removes admin privileges from Team Lead roles
- **Changes**:
  - Updates existing Team Lead roles: `admin_role = FALSE`
  - Creates hierarchy-based permission functions
  - Updates `is_admin()` function to exclude Team Leads
  - Creates `has_admin_privileges()` function for comprehensive checks
- **Impact**: Team Leads no longer have admin privileges

### 4. `20250922000003-update-team-creation-functions.sql`
- **Purpose**: Ensures new teams create Team Lead roles without admin privileges
- **Changes**:
  - Updates all team creation functions
  - Updates team member creation/update functions
  - Ensures `admin_role = FALSE` for new Team Lead roles
- **Impact**: Future teams will have correctly configured Team Lead roles

### 5. `20250922000004-update-permission-functions.sql`
- **Purpose**: Implements hierarchy-based permission checking
- **Changes**:
  - Creates comprehensive permission functions
  - Implements role-based access control
  - Creates `get_user_effective_permissions()` function
  - Updates all admin privilege checks
- **Impact**: Permissions now based on hierarchy, not admin flags

### 6. `20250922000005-verify-team-lead-implementation.sql`
- **Purpose**: Comprehensive verification of the implementation
- **Changes**:
  - Verifies all Team Lead roles have `admin_role = FALSE`
  - Verifies all required functions and views exist
  - Creates verification report view
  - Provides detailed status reporting
- **Impact**: Ensures implementation is correct and complete

## Key Changes Summary

| **Aspect** | **Before (Problematic)** | **After (Correct)** |
|------------|-------------------------|-------------------|
| **Database Role** | `admin_role = TRUE` | `admin_role = FALSE` |
| **Frontend Session** | `is_admin = true` | `is_admin = false` |
| **Permission Model** | Admin-based | Hierarchy-based |
| **Access Scope** | Full team access | Only managed members |
| **Admin Center** | Full access | Limited to managed scope |
| **Billing Access** | Blocked (correct) | Blocked (correct) |

## New Permission Functions

### Hierarchy-Based Functions
- `is_team_lead_by_hierarchy(user_id, team_id)` - Checks if user has reports
- `get_team_lead_managed_members(user_id, team_id)` - Gets managed members
- `can_team_lead_access_member(lead_id, team_id, member_id)` - Access validation
- `get_team_lead_accessible_projects(user_id, team_id)` - Project access

### Permission Checking Functions
- `can_access_team_admin_features(user_id, team_id)` - Admin center access
- `can_manage_team_members(user_id, team_id)` - Member management
- `can_manage_team_projects(user_id, team_id)` - Project management
- `can_access_team_settings(user_id, team_id)` - Settings access
- `can_access_finance_features(user_id, team_id)` - Finance access
- `can_access_reporting_features(user_id, team_id)` - Reporting access
- `can_access_billing(user_id, team_id)` - Billing access (Owner only)
- `get_user_effective_permissions(user_id, team_id)` - Comprehensive permissions

## Testing the Implementation

### 1. Run All Migrations
```bash
# Run migrations in order
psql -d worklenz -f database/migrations/20250922000000-add-reports-to-team-members.sql
psql -d worklenz -f database/migrations/20250922000001-create-team-lead-member-views.sql
psql -d worklenz -f database/migrations/20250922000002-fix-team-lead-admin-privileges.sql
psql -d worklenz -f database/migrations/20250922000003-update-team-creation-functions.sql
psql -d worklenz -f database/migrations/20250922000004-update-permission-functions.sql
psql -d worklenz -f database/migrations/20250922000005-verify-team-lead-implementation.sql
```

### 2. Verify Implementation
```sql
-- Check verification report
SELECT * FROM team_lead_implementation_verification;

-- Verify Team Lead roles have no admin privileges
SELECT name, admin_role, owner, default_role 
FROM roles 
WHERE name = 'Team Lead';

-- Test hierarchy functions
SELECT is_team_lead_by_hierarchy('user-id', 'team-id');
SELECT * FROM get_team_lead_managed_members('user-id', 'team-id');
```

### 3. Test Team Lead Functionality
1. **Create a Team Lead** with direct reports
2. **Verify no admin privileges** in database
3. **Test hierarchy-based access** to managed members only
4. **Verify no Admin Center access** unless they have reports
5. **Test project access** is limited to assigned projects
6. **Verify billing access** is blocked (Owner only)

## Breaking Changes

### Frontend Changes Required
- **Remove `is_admin = true`** from Team Lead sessions
- **Update permission checks** to use new hierarchy-based functions
- **Modify Admin Center access** to check for managed members
- **Update role management UI** to reflect hierarchy-based permissions

### Backend Changes Required
- **Update all controllers** to use new permission functions
- **Modify session handling** to not grant admin privileges to Team Leads
- **Update API endpoints** to use hierarchy-based access control
- **Modify reporting controllers** to use new filtering logic

## Benefits of New Implementation

1. **Security**: Team Leads can only access their managed members
2. **Scalability**: Works with multiple Team Leads per team
3. **Flexibility**: Hierarchy can be adjusted without role changes
4. **Clarity**: Clear separation between Admin and Team Lead roles
5. **Compliance**: Follows principle of least privilege

## Rollback Plan

If rollback is needed:
1. **Restore admin privileges**: `UPDATE roles SET admin_role = TRUE WHERE name = 'Team Lead'`
2. **Revert permission functions** to use `admin_role` checks
3. **Update frontend** to grant admin privileges to Team Leads
4. **Test thoroughly** to ensure functionality is restored

## Monitoring

After implementation:
1. **Monitor Team Lead access patterns**
2. **Verify hierarchy relationships** are correctly established
3. **Check performance** of hierarchy-based queries
4. **Validate permission boundaries** are respected
5. **Monitor user feedback** on new access model

---

**Note**: This implementation represents a fundamental change in how Team Lead permissions work. Thorough testing is required before deploying to production.
