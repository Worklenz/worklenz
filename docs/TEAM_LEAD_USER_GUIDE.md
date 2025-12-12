# Team Lead Management - User Guide

## 📋 Table of Contents

1. [Overview](#overview)
2. [Role Hierarchy](#role-hierarchy)
3. [Adding Team Lead Members](#adding-team-lead-members)
4. [Converting Existing Members to Team Lead](#converting-existing-members-to-team-lead)
5. [Assigning Members Under Team Leads](#assigning-members-under-team-leads)
6. [Team Lead Permissions & Access](#team-lead-permissions--access)
7. [Viewing Team Lead Analytics](#viewing-team-lead-analytics)
8. [Project Management for Team Leads](#project-management-for-team-leads)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

The **Team Lead** role provides admin-level access scoped to specific teams, offering the perfect balance between delegation and control. Team Leads have comprehensive management capabilities within their assigned teams while maintaining security boundaries.

### Key Benefits
- ✅ **Delegated Authority**: Full administrative control within assigned teams
- ✅ **Project-Scoped Access**: Automatic access to projects they create or are assigned to
- ✅ **Enhanced Security**: Cannot access other teams or organization-wide settings
- ✅ **Seamless Integration**: Works with all existing features including finance, reporting, and analytics

---

## 🏗️ Role Hierarchy

Understanding the role hierarchy is crucial for proper team management:

| Role | Access Level | Color Code | Permissions |
|------|-------------|------------|-------------|
| **Owner** | Organization-wide | Blue | Full access + billing management |
| **Admin** | Organization-wide | Dark Yellow | Full admin access across all teams |
| **Team Lead** | Team-scoped | Vibrant Orange | Admin access within assigned team |
| **Member** | Project-based | Light Gray | Standard team member access |

> **Note**: Team Leads have `admin_role = TRUE` in the database but with team-scoped permissions.

---

## 👥 Adding Team Lead Members

### Method 1: Invite New Team Members as Team Lead

1. **Navigate to Team Settings**
   ```
   Settings → Team Members
   ```

2. **Click "Add New Member" Button**
   - Located in the top-right corner of the team members page

3. **Fill Invitation Form**
   - **Email(s)**: Enter the email address of the person you want to invite
   - **Job Title**: Select or enter job title (optional)
   - **Access Level**: Select **"Team Lead"** from the dropdown

4. **Send Invitation**
   - Click "Send Invitation" button
   - The invitee will receive an email invitation
   - They'll automatically have Team Lead permissions upon joining

### Method 2: Bulk Invite Multiple Team Leads

1. **Use Bulk Invitation**
   - In the invitation modal, enter multiple email addresses
   - Separate emails with commas or new lines
   - Set Access Level to "Team Lead"
   - Send bulk invitations

---

## 🔄 Converting Existing Members to Team Lead

### Step-by-Step Process

1. **Access Team Members List**
   ```
   Settings → Team Members
   ```

2. **Locate the Member**
   - Use the search bar to find specific members
   - Or scroll through the member list

3. **Edit Member Role**
   - Click the **Edit** button (pencil icon) next to the member's name
   - In the "Update Team Member" drawer that opens:
     - **Access Level**: Change from current role to **"Team Lead"**
     - Keep other details unchanged if desired

4. **Save Changes**
   - Click "Save Changes" button
   - The member will immediately gain Team Lead permissions

### Role Change Validation

The system validates role changes based on current user permissions:
- ✅ **Owners** can assign any role
- ✅ **Admins** can assign Team Lead and Member roles
- ❌ **Team Leads** cannot promote members to Admin or Owner level

---

## 👨‍👩‍👧‍👦 Assigning Members Under Team Leads

### Individual Assignment

1. **From Team Members Page**
   ```
   Settings → Team Members
   ```

2. **Use "Assign Team Lead" Button**
   - Click the **Team Lead icon** (👥) next to any member
   - This opens the assignment modal

3. **Select Team Lead**
   - Choose from available Team Leads in your team
   - Preview shows which members will be managed

4. **Confirm Assignment**
   - Review the assignment details
   - Click "Assign" to confirm

### Bulk Assignment (Recommended for Multiple Members)

1. **Select Multiple Members**
   - Use checkboxes to select multiple team members
   - Only Members can be assigned to Team Leads (not Admins/Owners)

2. **Click "Bulk Assign Team Lead"**
   - Button appears when multiple members are selected

3. **Choose Team Lead**
   - **Select Team Lead**: Choose from dropdown of available Team Leads
   - **Assignment Preview**: Shows how many members will be assigned

4. **Complete Assignment**
   - Review the preview: "Will manage X member(s)"
   - Click "Assign X Members" button
   - Success message confirms the assignment

### Assignment Rules

- ❌ **Cannot assign**: Owners, Admins, or other Team Leads
- ✅ **Can assign**: Regular Members only
- 🔄 **Reassignment**: Members can be reassigned to different Team Leads
- 📊 **Hierarchy**: Creates clear reporting structure

---

## 🔐 Team Lead Permissions & Access

### What Team Leads CAN Do

#### Team Management
- ✅ **Manage Team Members**: Invite, edit, deactivate members
- ✅ **Assign Roles**: Change member roles (except to Admin/Owner)
- ✅ **Team Settings**: Access labels, categories, workflows
- ✅ **Member Assignment**: Assign members to projects

#### Project Management
- ✅ **Create Projects**: Automatically become project admin
- ✅ **Manage Assigned Projects**: Full admin access to projects they're assigned to
- ✅ **Project Finance**: View and edit financial data for assigned projects
- ✅ **Task Management**: Create, edit, assign tasks within their projects

#### Reporting & Analytics
- ✅ **Team Analytics**: View performance data for managed members
- ✅ **Project Reports**: Access reports for assigned projects only
- ✅ **Time Tracking**: Monitor time logs for their team members
- ✅ **Performance Metrics**: Task completion, project progress, workload analysis

### What Team Leads CANNOT Do

#### Restricted Access
- ❌ **Other Teams**: Cannot access or manage other teams
- ❌ **Organization Settings**: No access to company-wide settings
- ❌ **Billing**: Cannot view or manage subscription/billing
- ❌ **Unassigned Projects**: Cannot see projects they're not assigned to

#### Role Limitations
- ❌ **Promote to Admin**: Cannot make members Admins or Owners
- ❌ **Cross-team Management**: Cannot manage members from other teams
- ❌ **Global Reports**: Cannot access organization-wide analytics

---

## 📊 Viewing Team Lead Analytics

### Accessing Analytics Dashboard

1. **Navigate to Team Lead Reports**
   ```
   Main Navigation → Reports
   ```
   
   > **Note**: This menu item only appears for Team Leads

2. **Dashboard Overview**
   The Team Lead analytics dashboard provides:
   - **Team Performance Summary**
   - **Member Statistics**
   - **Time Tracking Data**
   - **Project Progress Metrics**

### Available Analytics Features

#### 📈 Performance Statistics
- **Task Completion Rates**: See how many tasks each member completes
- **Time Efficiency**: Track time spent vs. estimated time
- **Project Involvement**: Monitor which projects members are active in
- **Overdue Task Tracking**: Identify bottlenecks and delays

#### ⏱️ Time Log Analysis
- **Daily/Weekly Time Summaries**: Aggregate time tracking data
- **Detailed Time Logs**: Drill down into specific member activities
- **Project Time Distribution**: See time allocation across projects
- **Date Range Filtering**: Analyze performance over custom periods

#### 👥 Team Member Insights
- **Individual Performance**: Detailed stats for each managed member
- **Workload Distribution**: Ensure balanced task allocation
- **Activity Patterns**: Understand when team members are most productive
- **Hierarchy View**: Visualize reporting relationships

### Using the Analytics Interface

#### Time Range Selection
1. **Quick Filters**: This Week, This Month, This Quarter
2. **Custom Range**: Select specific start and end dates
3. **Date Picker**: Use calendar interface for precise selection

#### Detailed Member Reports
1. **Click on Member**: Select any team member from the list
2. **View Details**: See comprehensive performance data
3. **Time Log Drill-down**: Access detailed time tracking records
4. **Export Options**: Download reports for offline analysis

#### Performance Metrics
- **Completion Percentage**: Visual progress indicators
- **Task Counts**: Assigned vs. completed vs. overdue
- **Time Metrics**: Hours logged, efficiency ratings
- **Project Participation**: Active project involvement

---

## 🚀 Project Management for Team Leads

### Automatic Project Access

#### Creating Projects
1. **Create New Project**: Team Leads can create projects normally
2. **Automatic Membership**: Automatically added as project ADMIN member
3. **Full Management**: Complete administrative access to their created projects

#### Project Assignment
1. **Manual Assignment**: Admins/Owners can assign Team Leads to existing projects
2. **Member-level Access**: Added as project members with appropriate permissions
3. **Scoped Visibility**: Only see projects they're assigned to

### Project-Scoped Permissions

#### What Team Leads See
- ✅ **Assigned Projects**: Projects they created or are assigned to as members
- ✅ **Project Teams**: Members working on their assigned projects
- ✅ **Project Analytics**: Reporting data for assigned projects only
- ✅ **Financial Data**: Budget and cost information for assigned projects

#### Data Isolation
- 🔒 **Secure Access**: No accidental access to unrelated project data
- 🎯 **Relevant Data**: Only see team members working on assigned projects
- 📊 **Filtered Reports**: All analytics automatically filtered to assigned projects
- 🔍 **Query Optimization**: Efficient database queries using project membership

---

## 🛠️ Troubleshooting

### Common Issues & Solutions

#### Team Lead Role Not Available
**Problem**: "Team Lead" option not showing in role dropdown
**Solution**: 
1. Ensure you have Admin or Owner permissions
2. Verify the team has been migrated (automatic for existing teams)
3. Refresh the page and try again

#### Cannot Assign Members to Team Lead
**Problem**: Assignment button disabled or not working
**Solutions**:
1. **Check Role Permissions**: Only Admins/Owners can assign Team Leads
2. **Verify Member Role**: Cannot assign Admins/Owners to Team Leads
3. **Active Members Only**: Ensure members are active (not deactivated)

#### Team Lead Cannot See Analytics
**Problem**: "Reports" menu not appearing
**Solutions**:
1. **Role Verification**: Confirm user has Team Lead role assigned
2. **Session Refresh**: Log out and log back in
3. **Browser Cache**: Clear browser cache and cookies

#### Project Access Issues
**Problem**: Team Lead cannot access expected projects
**Solutions**:
1. **Project Membership**: Ensure Team Lead is added as project member
2. **Automatic Assignment**: For created projects, membership should be automatic
3. **Manual Assignment**: Admin/Owner may need to manually assign to existing projects

#### Analytics Not Showing Data
**Problem**: Empty or missing analytics data
**Solutions**:
1. **Member Assignment**: Ensure members are assigned to the Team Lead
2. **Project Activity**: Verify team members have tasks/time logs in assigned projects
3. **Date Range**: Check if selected date range includes activity period
4. **Permissions**: Confirm Team Lead has access to relevant projects

### Getting Help

#### Support Channels
1. **In-App Support**: Use the help/support feature within Worklenz
2. **Documentation**: Refer to this guide and other documentation
3. **Admin Assistance**: Contact your organization's Admin or Owner
4. **Technical Support**: Reach out to Worklenz support team

#### Best Practices
1. **Regular Review**: Periodically review team member assignments
2. **Project Planning**: Ensure Team Leads are assigned to relevant projects
3. **Permission Audits**: Regularly verify role assignments are correct
4. **Training**: Provide Team Leads with proper onboarding and training

---

## 🎯 Quick Reference

### Essential Actions for Admins/Owners

| Action | Navigation | Steps |
|--------|------------|-------|
| **Add Team Lead** | Settings → Team Members | Add Member → Select "Team Lead" role |
| **Convert Member** | Settings → Team Members | Edit Member → Change to "Team Lead" |
| **Assign Members** | Settings → Team Members | Select Members → Bulk Assign Team Lead |
| **View Team Structure** | Settings → Team Members | Review role hierarchy and assignments |

### Essential Actions for Team Leads

| Action | Navigation | Steps |
|--------|------------|-------|
| **View Analytics** | Reports | Access comprehensive team performance data |
| **Manage Members** | Settings → Team Members | Invite, edit, assign team members |
| **Create Projects** | Projects → New Project | Automatically gain admin access |
| **Track Performance** | Reports | Monitor member productivity and progress |

---

## 📝 Summary

The Team Lead role provides powerful delegation capabilities while maintaining security and organizational structure. By following this guide, you can effectively:

- ✅ Set up Team Lead roles for appropriate team members
- ✅ Assign team members to Team Leads for better management
- ✅ Utilize comprehensive analytics for team performance monitoring
- ✅ Maintain proper project access and permissions
- ✅ Troubleshoot common issues and optimize team workflows

The Team Lead feature scales with your organization, supporting multiple Team Leads managing different team segments while providing granular control and comprehensive reporting capabilities.

