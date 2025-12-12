# Worklenz Slack Integration - QA Testing Guide

## 1. Overview

This document provides a comprehensive guide for the Quality Assurance (QA) team to test the Worklenz Slack integration. The integration allows teams to connect their Slack workspace to Worklenz to receive notifications and interact with tasks directly from Slack.

## 2. Prerequisites

Before you begin testing, ensure you have the following:

- **A Worklenz Test Account**: With permissions to manage a team and projects.
- **Multiple Subscription Types**: Test accounts with different subscription plans:
  - Free plan account
  - Business plan account (or Business trial)
  - Self-hosted account (optional)
- **A Slack Workspace**: A dedicated test workspace where you have administrative privileges to install apps.
- **At least two user accounts** in both Worklenz and the Slack workspace to test assignments and interactions.
- **At least two projects** set up in Worklenz with a few tasks.

## 2.1. Important Notes

⚠️ **Business Plan Requirement**: Slack integration is only available to users on Business, Enterprise, or Self-Hosted plans. Free plan users will see a locked state with upgrade prompts.

## 3. Test Scenarios

### 3.1. Subscription Plan Validation

This section tests the business plan requirement for Slack integration.

| Test Case ID | Description | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| SL-PLAN-01 | **Free User - Settings Page Access** | 1. Log in with a **Free plan** account.<br>2. Go to `Settings` -> `Integrations`. | The Slack integration section should show an upgrade prompt or be disabled with a "Business Plan Required" message. | Pass/Fail |
| SL-PLAN-02 | **Free User - Project Integration Button** | 1. Log in with a **Free plan** account.<br>2. Open any project.<br>3. Look for the Integrations button (🔌) in the project header. | The button should display with a **crown icon (👑)** badge.<br>Tooltip: "Integrations available on Business plan". | Pass/Fail |
| SL-PLAN-03 | **Free User - Click Integration Button** | 1. As a free user, click the locked integrations button. | The **upgrade modal** should open, prompting to upgrade to Business plan. | Pass/Fail |
| SL-PLAN-04 | **Free User - No API Calls Made** | 1. Log in as free user.<br>2. Open any project.<br>3. Open browser DevTools Network tab.<br>4. Observe network requests. | **No Slack API calls** should be made (`/api/v1/slack/*`).<br>No 403 errors in console. | Pass/Fail |
| SL-PLAN-04b | **Free User - API Access Blocked (Manual)** | 1. As a free user, manually call Slack API endpoints (requires dev tools).<br>2. Try: `GET /api/v1/slack/status` | Should return **403 Forbidden** with message: "This feature requires a Business plan". | Pass/Fail |
| SL-PLAN-05 | **Business User - Full Access** | 1. Log in with a **Business plan** account.<br>2. Navigate to `Settings` -> `Integrations`. | The Slack integration card should be fully accessible with "Connect" button. | Pass/Fail |
| SL-PLAN-06 | **Business Trial User - Full Access** | 1. Log in with a **Business Trial** account.<br>2. Navigate to integrations. | Should have full access to Slack integration during trial period. | Pass/Fail |
| SL-PLAN-07 | **Self-Hosted User - Full Access** | 1. Log in with a **Self-Hosted** account.<br>2. Navigate to integrations. | Should have full access to Slack integration. | Pass/Fail |

### 3.2. Connection and Disconnection

This section covers the core functionality of connecting and disconnecting a Slack workspace.

**Prerequisite**: Use a Business plan account for these tests.

| Test Case ID | Description | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| SL-CONN-01 | **Navigate to Slack Integration Settings** | 1. Log in to Worklenz (Business plan).<br>2. Go to `Settings` -> `Integrations`.<br>3. Locate the Slack integration section. | The Slack integration card is displayed, showing a "Connect" button. | Pass/Fail |
| SL-CONN-02 | **Initiate Slack Connection** | 1. From the Slack integration card, click "Connect Slack Workspace". | You are redirected to the Slack OAuth2 authorization screen. | Pass/Fail |
| SL-CONN-03 | **Authorize the Worklenz App in Slack** | 1. On the Slack authorization screen, select your test workspace.<br>2. Click "Allow". | You are redirected back to the Worklenz integrations page.<br>A success message is displayed.<br>The Slack integration card now shows a "Connected" status with the workspace name. | Pass/Fail |
| SL-CONN-04 | **Cancel the Slack Authorization** | 1. Initiate the connection process.<br>2. On the Slack authorization screen, click "Cancel". | You are redirected back to the Worklenz integrations page.<br>An informational message about the cancellation is shown.<br>The workspace remains disconnected. | Pass/Fail |
| SL-CONN-05 | **Disconnect the Slack Workspace** | 1. Navigate to the connected Slack integration card.<br>2. Click the "Manage" or "Disconnect" button.<br>3. Confirm the disconnection in the modal. | The workspace is disconnected.<br>A success message is displayed.<br>The card reverts to the initial "Connect" state. | Pass/Fail |

### 3.3. Project-Level Integration (Quick Add)

This section tests the new project-level integration feature that allows adding Slack directly from the project view.

**Prerequisite**: Business plan account with Slack workspace connected.

| Test Case ID | Description | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| SL-PROJ-01 | **View Integrations Button in Project** | 1. Open any project.<br>2. Look for the Integrations button (🔌) in the project header (between Settings and Subscribe). | Button is visible with API icon.<br>Shows badge count if integrations are active. | Pass/Fail |
| SL-PROJ-02 | **Open Integrations Dropdown** | 1. Click the Integrations button. | Dropdown opens showing:<br>- Slack (with status/count)<br>- Microsoft Teams (Coming Soon)<br>- GitHub (Coming Soon)<br>- "Manage All Integrations" link | Pass/Fail |
| SL-PROJ-03 | **View Slack Status - Not Connected** | 1. With Slack workspace **not connected**, open integrations dropdown. | Slack item shows "Add" button.<br>Clicking shows warning: "Please connect your Slack workspace in Settings first". | Pass/Fail |
| SL-PROJ-04 | **View Slack Status - Connected** | 1. With Slack workspace **connected**, open integrations dropdown. | Slack item shows configured channels (e.g., "#general, #dev-team") and count badge (e.g., "✓ 2"). | Pass/Fail |
| SL-PROJ-05 | **Quick Add Slack - Open Modal** | 1. With Slack connected, click on Slack item in dropdown. | "Add Slack to Project" modal opens with:<br>- Current project name displayed<br>- Slack channel dropdown<br>- Notification types (pre-selected: Task Created, Task Assigned, Status Changed)<br>- Refresh button next to channel dropdown<br>- Tip about inviting @Worklenz bot | Pass/Fail |
| SL-PROJ-06 | **Quick Add Slack - Refresh Channels** | 1. In the quick-add modal, click the "Refresh" button. | Loading indicator appears.<br>Channel list refreshes.<br>Success message: "Channels refreshed successfully". | Pass/Fail |
| SL-PROJ-07 | **Quick Add Slack - Add Integration** | 1. Select a Slack channel.<br>2. Select notification types.<br>3. Click "Add Integration". | Success message: "Slack integration added successfully!"<br>Modal closes.<br>Dropdown now shows the new channel in the list.<br>Badge count increments. | Pass/Fail |
| SL-PROJ-08 | **Quick Add Slack - Validation** | 1. Open quick-add modal.<br>2. Click "Add Integration" without selecting a channel. | Validation error: "Please select a Slack channel". | Pass/Fail |
| SL-PROJ-09 | **Quick Add Slack - Validation (Notifications)** | 1. Open quick-add modal.<br>2. Select a channel but deselect all notification types.<br>3. Click "Add Integration". | Validation error: "Please select at least one notification type". | Pass/Fail |
| SL-PROJ-10 | **Manage All Integrations Link** | 1. Open integrations dropdown.<br>2. Click "Manage All Integrations". | Redirects to `/worklenz/settings/integrations` page. | Pass/Fail |
| SL-PROJ-11 | **Coming Soon Items** | 1. Open integrations dropdown.<br>2. Observe Microsoft Teams and GitHub items. | Both show "🔜 Coming Soon" badge.<br>Items are grayed out and not clickable. | Pass/Fail |
| SL-PROJ-12 | **Integration Count Badge** | 1. Add multiple Slack channels to a project.<br>2. Observe the integrations button. | Badge shows total count of active integrations (e.g., "2").<br>Button turns primary color when count > 0. | Pass/Fail |

### 3.4. Notification Configuration (Settings Page)

This section covers setting up notifications from the Settings page.

| Test Case ID | Description | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| SL-CONF-01 | **View Channel Configuration Interface** | 1. With Slack connected, click "Manage" on the integration card. | An interface for managing channel configurations is displayed. | Pass/Fail |
| SL-CONF-02 | **Add a New Project-Channel Link** | 1. Click "Add Configuration".<br>2. Select a Worklenz project from the dropdown.<br>3. Select a Slack channel from the dropdown (should list public and private channels the bot is in).<br>4. Select notification types (e.g., Task Created, Task Assigned).<br>5. Save the configuration. | The new configuration is added to the list and is active.<br>A success message is shown. | Pass/Fail |
| SL-CONF-03 | **Edit an Existing Configuration** | 1. Find an existing configuration.<br>2. Click "Edit".<br>3. Change the selected notifications (e.g., add "Task Completed").<br>4. Save the changes. | The configuration is updated with the new settings. | Pass/Fail |
| SL-CONF-04 | **Delete a Configuration** | 1. Find an existing configuration.<br>2. Click the "Delete" icon.<br>3. Confirm the deletion. | The configuration is removed from the list.<br>Notifications for that project/channel link should cease. | Pass/Fail |
| SL-CONF-05 | **Refresh Channels Button** | 1. In the channel configuration modal, click the "Refresh" button next to the channel dropdown. | Loading indicator appears.<br>Channel list refreshes from Slack.<br>Success message shown. | Pass/Fail |

### 3.5. Notification Events

This section tests if notifications are triggered correctly based on user actions in Worklenz.

**Prerequisite**: A project must be configured to send notifications to a specific Slack channel.

| Test Case ID | Description | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| SL-NOTIF-01 | **Task Created Notification** | 1. In the configured project, create a new task. | A notification appears in the linked Slack channel with the task details and a "View Task" button. | Pass/Fail |
| SL-NOTIF-02 | **Task Assigned Notification** | 1. In the configured project, assign a task to a user. | A notification appears in the linked Slack channel stating who was assigned the task. | Pass/Fail |
| SL-NOTIF-03 | **Task Status Change Notification** | 1. In the configured project, change the status of a task (e.g., from "To Do" to "In Progress"). | A notification appears in the linked Slack channel reflecting the status change. | Pass/Fail |
| SL-NOTIF-04 | **Task Comment Notification** | 1. In the configured project, add a comment to a task. | A notification appears in the linked Slack channel with the comment content. | Pass/Fail |

### 3.6. Slash Commands

This section tests the functionality of slash commands within the connected Slack workspace.

| Test Case ID | Description | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| SL-CMD-01 | **Create Task via Slash Command (Valid)** | 1. In any channel in the connected Slack workspace, type:<br>`/worklenz-task New task from Slack | Project Name` | An ephemeral confirmation message is shown in Slack.<br>The task is created in the specified project in Worklenz. | Pass/Fail |
| SL-CMD-02 | **Create Task via Slash Command (Invalid)** | 1. Type: `/worklenz-task` with no parameters. | An ephemeral message is shown in Slack with usage instructions. | Pass/Fail |
| SL-CMD-03 | **View Project Info (Not Implemented)** | 1. Type: `/worklenz-project Project Name` | An ephemeral message should indicate the command is pending implementation. | Pass/Fail |
| SL-CMD-04 | **Assign Task (Not Implemented)** | 1. Type: `/worklenz-assign Task Name to @user` | An ephemeral message should indicate the command is pending implementation. | Pass/Fail |

## 4. Security and Error Handling

### 4.1. Project Access Control

| Test Case ID | Description | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| SL-SEC-01 | **Invalid Project ID Format** | 1. Use dev tools to call API with invalid UUID format:<br>`GET /api/v1/slack/channel-configs/project/invalid-id` | Should return **400 Bad Request** with message: "Invalid project ID format". | Pass/Fail |
| SL-SEC-02 | **Access Project from Different Organization** | 1. User A creates a project.<br>2. User B (different organization) attempts to access project integrations via API. | Should return **403 Forbidden** with message: "Access denied: Project not found or you don't have access". | Pass/Fail |
| SL-SEC-03 | **Non-existent Project ID** | 1. Use valid UUID format but non-existent project ID.<br>2. Try to get channel configs. | Should return **403 Forbidden** (project not found). | Pass/Fail |

### 4.2. Subscription Validation

| Test Case ID | Description | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| SL-SEC-04 | **Free User API Access Blocked** | 1. Log in as free user.<br>2. Use dev tools to call:<br>`GET /api/v1/slack/status` | Should return **403 Forbidden** with message: "This feature requires a Business plan". | Pass/Fail |
| SL-SEC-05 | **Free User Cannot Create Config** | 1. Log in as free user.<br>2. Attempt to create channel config via API. | Should return **403 Forbidden** with business plan requirement message. | Pass/Fail |
| SL-SEC-06 | **Trial Expiration** | 1. Use account with expired Business trial.<br>2. Attempt to access Slack integration. | Should be blocked with 403 error (treated as free user). | Pass/Fail |

### 4.3. OAuth and Connection Security

| Test Case ID | Description | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| SL-SEC-07 | **Expired OAuth State** | 1. Manually construct an OAuth URL with an old `state` parameter (requires dev assistance). | The OAuth callback should fail with an error, and the user should be redirected to an error page. The connection should not be established. | Pass/Fail |
| SL-SEC-08 | **Workspace Ownership Verification** | 1. User A connects a Slack workspace.<br>2. User B (different organization) attempts to access that workspace's data. | User B should not see or access User A's workspace data. | Pass/Fail |

### 4.4. Error Handling

| Test Case ID | Description | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| SL-ERR-01 | **Notification to Invalid Channel** | 1. Configure notifications to a channel.<br>2. In Slack, archive or delete that channel.<br>3. Trigger a notification. | The action in Worklenz (e.g., creating a task) should still succeed.<br>The system should log a failure for the notification attempt but not crash. | Pass/Fail |
| SL-ERR-02 | **Network Failure During Channel Refresh** | 1. Open quick-add modal.<br>2. Simulate network failure (disconnect internet).<br>3. Click "Refresh" button. | Error message: "Failed to refresh channels".<br>UI remains functional. | Pass/Fail |
| SL-ERR-03 | **Workspace Not Connected** | 1. Without connecting Slack workspace, try to add integration from project. | Warning message: "Please connect your Slack workspace in Settings first". | Pass/Fail |

## 5. Internationalization (i18n)

| Test Case ID | Description | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| SL-I18N-01 | **English Translations** | 1. Set language to English.<br>2. Navigate through all Slack integration features. | All text displays in English with no missing translations. | Pass/Fail |
| SL-I18N-02 | **German Translations** | 1. Set language to German.<br>2. Check integrations button, dropdown, modals. | All integration-related text displays in German. | Pass/Fail |
| SL-I18N-03 | **Spanish Translations** | 1. Set language to Spanish.<br>2. Check all integration features. | All text displays in Spanish. | Pass/Fail |
| SL-I18N-04 | **Other Languages** | 1. Test with Albanian, Portuguese, Chinese.<br>2. Verify all integration features. | All languages display correctly with proper translations. | Pass/Fail |
| SL-I18N-05 | **Upgrade Message Translations** | 1. As free user, hover over locked integration button.<br>2. Test in multiple languages. | Tooltip "Integrations available on Business plan" displays in correct language. | Pass/Fail |

## 6. Dark/Light Theme Compatibility

| Test Case ID | Description | Steps | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| SL-THEME-01 | **Light Theme** | 1. Set theme to Light.<br>2. Open integrations dropdown and modals. | All components display correctly with proper contrast and colors. | Pass/Fail |
| SL-THEME-02 | **Dark Theme** | 1. Set theme to Dark.<br>2. Open integrations dropdown and modals. | All components display correctly in dark theme with proper colors. | Pass/Fail |
| SL-THEME-03 | **Crown Icon Visibility** | 1. As free user, view premium integration button in both themes. | Crown icon is clearly visible in both light and dark themes with golden color. | Pass/Fail |

## 7. Notes for Testers

### Key Changes in Latest Update:
1. **Business Plan Requirement**: Slack integration now requires Business plan or higher
2. **Project-Level Integration**: New quick-add feature from project header
3. **Improved Error Handling**: Better validation and error messages
4. **Refresh Channels**: New button to refresh channel list from Slack
5. **Coming Soon Items**: MS Teams and GitHub shown as future integrations

### Testing Priority:
- **High Priority**: Subscription validation, project access control, quick-add feature
- **Medium Priority**: Notification events, error handling, i18n
- **Low Priority**: Slash commands (if implemented), theme compatibility

### Common Issues to Watch For:
- Free users should never access integration features
- **No API calls should be made for free users** (prevents 403 errors)
- Crown icon (👑) should be visible for free users, not lock icon
- Project access must be validated (organization ownership)
- All user-facing text must be translated (no hardcoded English)
- Dark/light theme compatibility
- Loading states and error messages

This guide provides comprehensive coverage. Testers are encouraged to explore edge cases and variations of these scenarios.
