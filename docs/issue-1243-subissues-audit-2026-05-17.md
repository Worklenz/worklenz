# Issue #1243 Sub-Issue Audit (CLI-based)

- Parent issue: https://github.com/Worklenz/worklenz-business/issues/1243
- Audit date: 2026-05-17 (updated after implementation pass)
- Method: `gh` CLI (`subIssues` via GraphQL) + repository code scan
- Note: This is an implementation audit from code/state in this repo, not a QA pass in running environments.

## Summary

- Total sub-issues found: 17 (`#1244`, `#1247`-`#1260`)
- Likely fixed/implemented: 17
- Needs work / not clearly implemented: 0

## Sub-issue Status

### #1244 - Block member invite at AppSumo seat limit + deactivate/upgrade flow
- URL: https://github.com/Worklenz/worklenz-business/issues/1244
- Status: **Likely fixed (core flow implemented)**
- Evidence:
  - Seat-limit blocking modal component with non-dismissible backdrop/escape behavior:
    - `worklenz-frontend/src/components/common/seat-limit-modal/SeatLimitModal.tsx`
  - Team/project invite flows detect `SEAT_LIMIT_EXCEEDED`, hold pending invite, route to deactivate/upgrade:
    - `worklenz-frontend/src/components/common/invite-team-members/InviteTeamMembers.tsx`
    - `worklenz-frontend/src/components/common/invite-project-members/InviteProjectMembers.tsx`
  - Auto-send of pending invite after member deactivation:
    - `worklenz-frontend/src/pages/settings/team-members/team-members-settings.tsx`

### #1247 - Seat limit popover + upgrade flow in Projects > Members
- URL: https://github.com/Worklenz/worklenz-business/issues/1247
- Status: **Likely fixed**
- Evidence:
  - Seat usage text, "Add More Seats" button, gated popover + upgrade CTA:
    - `worklenz-frontend/src/pages/projects/projectView/members/project-view-members.tsx`

### #1248 - Seat limit popover + upgrade flow in Settings > Members
- URL: https://github.com/Worklenz/worklenz-business/issues/1248
- Status: **Likely fixed**
- Evidence:
  - Workspace seat usage text, "Add More Seats" flow, popover + upgrade CTA:
    - `worklenz-frontend/src/pages/settings/team-members/team-members-settings.tsx`

### #1249 - Gate custom fields beyond limit with upgrade flow
- URL: https://github.com/Worklenz/worklenz-business/issues/1249
- Status: **Likely fixed (implemented with grandfathered restriction handling)**
- Evidence:
  - Add flow gated for non-Business users when custom field count reaches threshold:
    - `worklenz-frontend/src/pages/projects/projectView/taskList/task-list-table/custom-columns/custom-column-modal/add-custom-column-button.tsx`
  - Edit/settings flow gated for non-Business users in grandfathered-over-limit scenario:
    - `worklenz-frontend/src/pages/projects/projectView/taskList/task-list-table/task-list-table.tsx`

### #1250 - Gate Client Portal nav access with popover/upgrade
- URL: https://github.com/Worklenz/worklenz-business/issues/1250
- Status: **Likely fixed**
- Evidence:
  - Navbar client portal gated popover with CTA that opens upgrade modal:
    - `worklenz-frontend/src/features/navbar/navbar.tsx`

### #1251 - Gate "See Spends" in task drawer with upgrade flow
- URL: https://github.com/Worklenz/worklenz-business/issues/1251
- Status: **Likely fixed**
- Evidence:
  - Business-access check branches into popover + upgrade CTA for "See Spends":
    - `worklenz-frontend/src/components/task-drawer/shared/info-tab/details/task-drawer-billable/task-drawer-billable.tsx`

### #1252 - Show storage usage + gate "Add More Storage" in Project Files
- URL: https://github.com/Worklenz/worklenz-business/issues/1252
- Status: **Likely fixed**
- Evidence:
  - Storage usage plus "Add More Storage" popover/upgrade CTA implemented:
    - `worklenz-frontend/src/pages/projects/projectView/files/project-view-files.tsx`

### #1253 - Block uploads over 25MB in Project Files + upgrade flow
- URL: https://github.com/Worklenz/worklenz-business/issues/1253
- Status: **Likely fixed**
- Evidence:
  - Plan-aware upload limit and messaging implemented (`25MB` for non-Business, higher for Business):
    - `worklenz-frontend/src/pages/projects/projectView/files/project-view-files.tsx`

### #1254 - Show max file size in task drawer attachments + upgrade flow
- URL: https://github.com/Worklenz/worklenz-business/issues/1254
- Status: **Likely fixed**
- Evidence:
  - Helper text + upgrade link added in attachments uploader.
  - Non-Business task attachment uploads are capped at `25MB` and route to the upgrade flow.
  - Business task attachment uploads show/use the higher `250MB` limit.
  - Files:
    - `worklenz-frontend/src/components/task-drawer/shared/info-tab/attachments/attachments-upload.tsx`
    - `worklenz-frontend/src/components/task-drawer/shared/info-tab/attachments/attachments-grid.tsx`
    - `worklenz-frontend/src/components/task-drawer/shared/info-tab/task-drawer-info-tab.tsx`

### #1255 - Allow select >25MB in comments, block on send with upgrade prompt
- URL: https://github.com/Worklenz/worklenz-business/issues/1255
- Status: **Likely fixed (core behavior)**
- Evidence:
  - Comment attachment selection remains allowed.
  - Non-Business send is blocked when any selected attachment is over `25MB`, with upgrade flow trigger.
  - Business users are not blocked by the non-Business `25MB` comment attachment gate:
    - `worklenz-frontend/src/components/task-drawer/shared/info-tab/info-tab-footer.tsx`

### #1256 - Lock/blur project update chat history >90 days + upgrade
- URL: https://github.com/Worklenz/worklenz-business/issues/1256
- Status: **Likely fixed (lock/upgrade boundary implemented)**
- Evidence:
  - Non-Business users see a 90-day boundary with "View Full History" upgrade prompt.
  - Business users see the full project update history without the lock boundary:
    - `worklenz-frontend/src/pages/projects/project-view-1/updates/project-view-updates.tsx`

### #1257 - Lock task activity history >90 days + upgrade
- URL: https://github.com/Worklenz/worklenz-business/issues/1257
- Status: **Likely fixed (lock/upgrade boundary implemented)**
- Evidence:
  - Non-Business users see a 90-day boundary with "View Full Activity" upgrade prompt.
  - Business users see full task activity history without the lock boundary:
    - `worklenz-frontend/src/components/task-drawer/shared/activity-log/task-drawer-activity-log.tsx`

### #1258 - Lock time log history >90 days + upgrade
- URL: https://github.com/Worklenz/worklenz-business/issues/1258
- Status: **Likely fixed (lock/upgrade boundary implemented)**
- Evidence:
  - Non-Business users see a 90-day boundary with "View Full Time Log" upgrade prompt.
  - Business users see full time log history without the lock boundary:
    - `worklenz-frontend/src/components/task-drawer/shared/time-log/task-drawer-time-log.tsx`

### #1259 - Lock comment history >90 days + upgrade
- URL: https://github.com/Worklenz/worklenz-business/issues/1259
- Status: **Likely fixed (lock/upgrade boundary implemented)**
- Evidence:
  - Non-Business users see a 90-day boundary with "View Full Comments" upgrade prompt.
  - Business users see full comment history without the lock boundary:
    - `worklenz-frontend/src/components/task-drawer/shared/info-tab/comments/task-comments.tsx`

### #1260 - Gate organization logo change in Admin Center + upgrade flow
- URL: https://github.com/Worklenz/worklenz-business/issues/1260
- Status: **Likely fixed**
- Evidence:
  - "Change Logo" visible and gated for non-eligible users with upgrade popover/CTA:
    - `worklenz-frontend/src/components/admin-center/overview/organization-logo/organization-logo.tsx`

## Notes / Risks

- All sub-issues are still `OPEN` on GitHub at the time of audit, so repo implementation and GitHub status are not yet synchronized.
- Some items marked "Likely fixed" still need QA verification against exact acceptance criteria copy, mobile behavior, keyboard focus management, and visual blur treatment details.

## Localization Update

- New/updated keys were added to `en` and translated across non-English locale packs:
  - `alb`, `de`, `es`, `pt`, `zh`
- Updated files per locale:
  - `common.json`
  - `project-view-files.json`
  - `project-view-updates.json`
  - `task-drawer/task-drawer.json`

## Validation Update - 2026-05-17

- Locale JSON validation passed for touched `en`, `alb`, `de`, `es`, `pt`, and `zh` files.
- Required task drawer keys for attachment limits, upgrade CTA, and 90-day lock messages are present in all six locale packs.
- Production frontend build passed with `npm -C worklenz-frontend run build`.
- Build notes:
  - Rollup emitted existing third-party `gantt-task-react` pure annotation warnings.
  - Sentry source map upload failed with `401 Invalid token`, but Vite still completed successfully with `built in 50.23s`.
- Validation correction applied:
  - 90-day history gates now only restrict non-Business users.
  - Task attachment helper text now interpolates `25MB` for non-Business and `250MB` for Business users.
