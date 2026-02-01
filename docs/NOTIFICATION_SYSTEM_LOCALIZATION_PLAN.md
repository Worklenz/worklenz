# Notification System Localization Implementation Plan

## Scope
Focus on core notification system localization (task assignments, comments, project/team notifications) while keeping email notifications unchanged for now.

## Strategy
- **Backward compatible**: Existing notifications remain as-is, new notifications use translation keys
- **External integrations**: Use triggering user's Worklenz locale for Slack/Teams
- **Translations**: Machine translation with native speaker review

---

## Phase 1: Backend i18n Infrastructure Setup

### 1.1 Install Dependencies
```bash
cd worklenz-backend
npm install i18next i18next-fs-backend
npm install --save-dev @types/i18next-fs-backend
```

### 1.2 Create Translation Directory Structure
```
worklenz-backend/
  locales/
    en/
      notifications.json
      external.json
    de/
      notifications.json
      external.json
    es/
      notifications.json
      external.json
    pt/
      notifications.json
      external.json
    alb/
      notifications.json
      external.json
    zh/
      notifications.json
      external.json
```

### 1.3 Create Backend i18n Configuration
**File**: `/worklenz-backend/src/config/i18n.ts` (NEW)

```typescript
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import path from 'path';

export async function initializeI18n() {
  await i18next
    .use(Backend)
    .init({
      fallbackLng: 'en',
      supportedLngs: ['en', 'de', 'es', 'pt', 'alb', 'zh'],
      ns: ['notifications', 'external'],
      defaultNS: 'notifications',
      backend: {
        loadPath: path.join(__dirname, '../../locales/{{lng}}/{{ns}}.json')
      },
      interpolation: {
        escapeValue: false // React already escapes
      }
    });

  return i18next;
}

export default i18next;
```

### 1.4 Create Translation Helper Service
**File**: `/worklenz-backend/src/shared/i18n-helper.ts` (NEW)

```typescript
import i18next from 'i18next';
import db from './db';

export class I18nHelper {
  /**
   * Fetch user's language preference from database
   */
  static async getUserLanguage(userId: string): Promise<string> {
    const result = await db.query(
      'SELECT language FROM users WHERE id = $1',
      [userId]
    );

    // Map database language enum to i18n locale codes
    const languageMap: Record<string, string> = {
      'en': 'en',
      'de': 'de',
      'es': 'es',
      'pt': 'pt',
      'alb': 'alb',
      'zh_cn': 'zh',
      'ko': 'en' // Korean not yet supported, fallback to English
    };

    const dbLanguage = result.rows[0]?.language || 'en';
    return languageMap[dbLanguage] || 'en';
  }

  /**
   * Translate a key with parameters
   */
  static translate(key: string, locale: string, params?: Record<string, any>): string {
    const i18n = i18next.cloneInstance({ lng: locale });
    return i18n.t(key, params);
  }

  /**
   * Get a cloned i18n instance for specific locale
   */
  static getI18nInstance(locale: string) {
    return i18next.cloneInstance({ lng: locale });
  }
}
```

### 1.5 Initialize i18n in Application Bootstrap
**File**: `/worklenz-backend/src/index.ts` or `/worklenz-backend/src/app.ts`

Add near the top of the file:
```typescript
import { initializeI18n } from './config/i18n';

// Before starting the server
(async () => {
  await initializeI18n();
  // ... rest of app initialization
})();
```

---

## Phase 2: Database Schema Enhancement

### 2.1 Add Translation Support Columns
**File**: `/worklenz-backend/database/migrations/add_notification_translation_support.sql` (NEW)

```sql
-- Add columns for translation key system
ALTER TABLE user_notifications
  ADD COLUMN IF NOT EXISTS message_key TEXT,
  ADD COLUMN IF NOT EXISTS message_params JSONB,
  ADD COLUMN IF NOT EXISTS notification_type_key TEXT;

-- Keep existing 'message' column for backward compatibility
-- Note: Do NOT drop the message column

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_notifications_message_key
  ON user_notifications(message_key);

COMMENT ON COLUMN user_notifications.message_key IS 'i18n translation key for the notification message';
COMMENT ON COLUMN user_notifications.message_params IS 'JSON object with interpolation parameters for translation';
COMMENT ON COLUMN user_notifications.notification_type_key IS 'Notification type identifier for client-side routing';
```

Run this migration:
```bash
psql -d worklenz_db -f add_notification_translation_support.sql
```

### 2.2 Update create_notification Function
**File**: `/worklenz-backend/database/sql/4_functions.sql`

Modify the `create_notification` function signature and implementation:

```sql
CREATE OR REPLACE FUNCTION create_notification(
    _user_id UUID,
    _team_id UUID,
    _task_id UUID DEFAULT NULL,
    _project_id UUID DEFAULT NULL,
    _message TEXT DEFAULT NULL,  -- Keep for backward compatibility
    _message_key TEXT DEFAULT NULL,  -- NEW
    _message_params JSONB DEFAULT NULL,  -- NEW
    _notification_type_key TEXT DEFAULT NULL  -- NEW
) RETURNS VOID AS $$
BEGIN
    INSERT INTO user_notifications(
        user_id,
        team_id,
        task_id,
        project_id,
        message,
        message_key,
        message_params,
        notification_type_key
    )
    VALUES(
        _user_id,
        _team_id,
        _task_id,
        _project_id,
        _message,
        _message_key,
        _message_params,
        _notification_type_key
    );
END;
$$ LANGUAGE plpgsql;
```

### 2.3 Refactor notify_task_assignment_update Function
**File**: `/worklenz-backend/database/sql/4_functions.sql` (around lines 4944-4950)

**Current code**:
```sql
IF (_type = 'ASSIGN') THEN
    _message = CONCAT('<b>', _reporter_name, '</b> has assigned you in <b>', _task_name, '</b>');
ELSE
    _message = CONCAT('<b>', _reporter_name, '</b> has removed you from <b>', _task_name, '</b>');
END IF;
PERFORM create_notification(_user_id, _team_id, _task_id, _project_id, _message);
```

**New code**:
```sql
IF (_type = 'ASSIGN') THEN
    _message_key = 'notifications.taskAssigned';
    _notification_type_key = 'TASK_ASSIGNMENT';
ELSE
    _message_key = 'notifications.taskRemoved';
    _notification_type_key = 'TASK_UNASSIGN';
END IF;

_message_params = JSON_BUILD_OBJECT(
    'reporter', _reporter_name,
    'task', _task_name
);

-- Call with new parameters (old message param = NULL for new notifications)
PERFORM create_notification(
    _user_id,
    _team_id,
    _task_id,
    _project_id,
    NULL,  -- message (legacy, keep NULL for new notifications)
    _message_key,
    _message_params,
    _notification_type_key
);
```

### 2.4 Update Other Notification-Generating Functions

Apply the same pattern to these functions in `4_functions.sql`:

1. **Team removal notification** (around line 5220):
   - Key: `notifications.teamRemoval`
   - Params: `{team, user}`

2. **Task addition to project** (search for task add notifications):
   - Key: `notifications.taskAdded`
   - Params: `{user, task, project}`

3. **Task removal from project**:
   - Key: `notifications.taskRemovedFromProject`
   - Params: `{user, task, project}`

4. **Project assignment**:
   - Key: `notifications.addedToProject`
   - Params: `{project}`

5. **Comment notifications**:
   - Key: `notifications.commentAdded`
   - Params: `{user, task}`

6. **Mention notifications**:
   - Key: `notifications.mentionedInComment`
   - Params: `{user, task}`

---

## Phase 3: Frontend Translation Setup

### 3.1 Add Notification Translation Keys
**Files to update**: `/worklenz-frontend/public/locales/{lang}/notifications.json`

For each language (en, de, es, pt, alb, zh), create/update the notifications.json file:

**English** (`/worklenz-frontend/public/locales/en/notifications.json`):
```json
{
  "taskAssigned": "<strong>{{reporter}}</strong> has assigned you in <strong>{{task}}</strong>",
  "taskRemoved": "<strong>{{reporter}}</strong> has removed you from <strong>{{task}}</strong>",
  "taskAdded": "<strong>{{user}}</strong> added \"<strong>{{task}}</strong>\" to the \"<strong>{{project}}</strong>\"",
  "taskRemovedFromProject": "<strong>{{user}}</strong> removed \"<strong>{{task}}</strong>\" from the \"<strong>{{project}}</strong>\"",
  "teamRemoval": "You have been removed from <strong>{{team}}</strong> by <strong>{{user}}</strong>",
  "addedToProject": "You have been added to the <strong>{{project}}</strong>",
  "commentAdded": "<strong>{{user}}</strong> commented on <strong>{{task}}</strong>",
  "mentionedInComment": "<strong>{{user}}</strong> mentioned you in a comment on <strong>{{task}}</strong>"
}
```

**Note**: Use machine translation (DeepL or Google Translate) for other languages, then review with native speakers.

### 3.2 Update navbar.json for UI Elements
**Files**: `/worklenz-frontend/public/locales/{lang}/navbar.json`

Add these keys to each language:
```json
{
  "notificationsDrawer": {
    "invitationMessage": "You have been invited to work with <1>{{teamName}}</1>.",
    "teamInvitation": "You have been invited to join {{teamName}}",
    "loading": "Loading...",
    "unread": "Unread",
    "read": "Read",
    "markAsRead": "Mark as read",
    "markAllAsRead": "Mark all as read",
    "noNotifications": "No notifications"
  }
}
```

### 3.3 Update Frontend Components

#### 3.3.1 Fix invitation-item.tsx
**File**: `/worklenz-frontend/src/components/navbar/notifications/notifications-drawer/notification/invitation-item.tsx`

**Line 83** - Replace:
```typescript
You have been invited to work with <b>{item.team_name}</b>.
```

With:
```typescript
<Trans
  i18nKey="notificationsDrawer.invitationMessage"
  values={{ teamName: item.team_name }}
  components={{ 1: <b /> }}
/>
```

**Lines 100, 111** - Replace `'Loading...'` with:
```typescript
{t('notificationsDrawer.loading')}
```

Add import at top:
```typescript
import { useTranslation, Trans } from 'react-i18next';

// In component:
const { t } = useTranslation('navbar');
```

#### 3.3.2 Fix notification-drawer.tsx
**File**: `/worklenz-frontend/src/components/navbar/notifications/notifications-drawer/notification/notfication-drawer.tsx`

**Line 104** - Replace:
```typescript
You have been invited to join ${data.team_name || 'a team'}
```

With:
```typescript
t('notificationsDrawer.teamInvitation', { teamName: data.team_name || 'a team' })
```

**Line 247** - Replace:
```typescript
options={['Unread', 'Read']}
```

With:
```typescript
options={[
  t('notificationsDrawer.unread'),
  t('notificationsDrawer.read')
]}
```

Add useTranslation hook at component top:
```typescript
const { t } = useTranslation('navbar');
```

#### 3.3.3 Create Notification Message Renderer
**File**: `/worklenz-frontend/src/utils/notification-message-renderer.tsx` (NEW)

```typescript
import { TFunction } from 'i18next';
import DOMPurify from 'dompurify';

export interface NotificationData {
  message?: string;  // Legacy format
  message_key?: string;  // New format
  message_params?: Record<string, any>;  // New format
}

/**
 * Renders notification message with i18n support
 * Handles both legacy (message) and new (message_key + params) formats
 */
export function renderNotificationMessage(
  notification: NotificationData,
  t: TFunction
): string {
  // New format: Use translation key
  if (notification.message_key && notification.message_key.startsWith('notifications.')) {
    const translatedMessage = t(notification.message_key, notification.message_params || {});
    return DOMPurify.sanitize(translatedMessage, {
      ALLOWED_TAGS: ['b', 'strong', 'i', 'em'],
      ALLOWED_ATTR: []
    });
  }

  // Legacy format: Use raw message (already translated/hardcoded)
  if (notification.message) {
    return DOMPurify.sanitize(notification.message, {
      ALLOWED_TAGS: ['b', 'strong', 'i', 'em'],
      ALLOWED_ATTR: []
    });
  }

  return '';
}
```

#### 3.3.4 Update Notification Template Component
**File**: `/worklenz-frontend/src/components/navbar/notifications/notifications-drawer/notification/notification-template.tsx`

Import the renderer:
```typescript
import { renderNotificationMessage } from '@/utils/notification-message-renderer';
import { useTranslation } from 'react-i18next';
```

Update the message rendering (around line where notification.message is used):
```typescript
const { t } = useTranslation('notifications');

// Replace direct message usage with:
const messageHtml = renderNotificationMessage(notification, t);

// Then render:
<div dangerouslySetInnerHTML={{ __html: messageHtml }} />
```

---

## Phase 4: Backend Notification Service Updates

### 4.1 Update NotificationsService
**File**: `/worklenz-backend/src/services/notifications/notifications.service.ts`

#### 4.1.1 Update sendInvitation Method (around line 70)

**Current code**:
```typescript
const html = `You have been added to the <b>${sanitizePlainText(project?.name)}</b> Project in <b>${sanitizePlainText(team?.name)}</b> Team.`;
```

**New code**:
```typescript
const messageKey = 'notifications.addedToProject';
const messageParams = {
  project: sanitizePlainText(project?.name),
  team: sanitizePlainText(team?.name)
};

// For real-time socket notification, translate using recipient's language
const recipientLanguage = await I18nHelper.getUserLanguage(userId);
const translatedMessage = I18nHelper.translate(messageKey, recipientLanguage, messageParams);

// Store structured data in database
await db.query(
  `INSERT INTO user_notifications (user_id, team_id, task_id, project_id, message_key, message_params, notification_type_key)
   VALUES ($1, $2, $3, $4, $5, $6, $7)`,
  [userId, teamId, taskId, projectId, messageKey, JSON.stringify(messageParams), 'PROJECT_ASSIGNMENT']
);

// Emit translated message via socket
this.io.to(userId).emit('notification', {
  message: translatedMessage,
  message_key: messageKey,
  message_params: messageParams,
  // ... other fields
});
```

#### 4.1.2 Update createTaskUpdate Method

Modify to:
1. Determine the notification type and message key
2. Build message parameters object
3. Fetch recipient's language preference
4. Translate message for real-time delivery
5. Store message_key + params in database (not translated message)

### 4.2 Refactor Message Template Classes

#### 4.2.1 Update TaskAdd.ts
**File**: `/worklenz-backend/src/services/notifications/messages/TaskAdd.ts`

**Current**:
```typescript
private template = `<user> added "<task>" to the "<project>".`;
```

**New**:
```typescript
export class TaskAdd {
  messageKey = 'notifications.taskAdded';

  getMessageParams(userName: string, taskName: string, projectName: string) {
    return {
      user: userName,
      task: taskName,
      project: projectName
    };
  }
}
```

#### 4.2.2 Update TaskRemove.ts
**File**: `/worklenz-backend/src/services/notifications/messages/TaskRemove.ts`

Apply same pattern with:
- `messageKey = 'notifications.taskRemovedFromProject'`
- `getMessageParams(userName, taskName, projectName)`

---

## Phase 5: External Integration Localization

### 5.1 Create External Integration Translation Files

Create `/worklenz-backend/locales/en/external.json`:
```json
{
  "slack": {
    "task_created": {
      "title": "Task Created"
    },
    "task_assigned": {
      "title": "Task Assigned"
    },
    "task_completed": {
      "title": "Task Completed"
    },
    "comment_added": {
      "title": "Comment Added"
    },
    "priority_changed": {
      "title": "Priority Changed"
    },
    "due_date_changed": {
      "title": "Due Date Changed"
    },
    "task_updated": {
      "title": "Task Updated"
    },
    "task_status_changed": {
      "title": "Task Status Changed"
    },
    "viewTask": "View Task",
    "assignedTo": "👥 Assigned To",
    "assignedBy": "👤 Assigned By",
    "statusChange": "📊 Status Change",
    "changedBy": "👤 Changed By",
    "createdBy": "Created By",
    "status": "Status",
    "priority": "Priority",
    "dueDate": "Due Date",
    "comment": "Comment"
  },
  "teams": {
    "task": "Task",
    "project": "Project",
    "assignees": "Assignees",
    "assignedBy": "Assigned By",
    "createdBy": "Created By",
    "commentedBy": "Commented By",
    "updatedBy": "Updated By",
    "status": "Status",
    "priority": "Priority",
    "dueDate": "Due Date",
    "previousStatus": "Previous Status",
    "newStatus": "New Status",
    "previousPriority": "Previous Priority",
    "newPriority": "New Priority"
  }
}
```

Replicate for all languages (de, es, pt, alb, zh) using machine translation.

### 5.2 Update ExternalNotificationsService
**File**: `/worklenz-backend/src/services/external-notifications.service.ts`

#### 5.2.1 Add Locale Support to Main Method

**Update method signature** (around line 41):
```typescript
public static async sendExternalNotifications(
  projectId: string,
  taskId: string,
  notificationType: string,
  userName: string,
  userId?: string,  // NEW: Add user ID to fetch locale
  additionalData?: any
) {
  // Fetch user's language preference
  const userLocale = userId
    ? await I18nHelper.getUserLanguage(userId)
    : 'en';  // Default to English if no user context

  // ... rest of method

  // Pass locale to formatting methods
  const slackMessage = this.formatSlackMessage(notificationType, taskData, userName, userLocale);
  const teamsMessage = this.formatTeamsMessage(notificationType, taskData, userName, userLocale);
}
```

#### 5.2.2 Refactor formatSlackMessage

**Current code** (lines 100-106):
```typescript
const title = notificationType === "task_created" ? "Task Created"
  : notificationType === "task_assigned" ? "Task Assigned"
  : notificationType === "task_completed" ? "Task Completed"
  : ...
```

**New code**:
```typescript
private static formatSlackMessage(
  notificationType: string,
  taskData: any,
  userName: string,
  locale: string  // NEW parameter
): any {
  const i18n = I18nHelper.getI18nInstance(locale);

  // Translate title based on notification type
  const titleKey = `external.slack.${notificationType}.title`;
  const title = i18n.t(titleKey, { defaultValue: 'Notification' });

  // Translate field labels
  const fields: any[] = [];

  if (taskData.assignee_names && taskData.assignee_names.length) {
    fields.push({
      type: "mrkdwn",
      text: `*${i18n.t('external.slack.assignedTo')}*\n${taskData.assignee_names.join(", ")}`
    });
  }

  if (userName) {
    const labelKey = notificationType === "task_created"
      ? 'external.slack.createdBy'
      : 'external.slack.assignedBy';
    fields.push({
      type: "mrkdwn",
      text: `*${i18n.t(labelKey)}*\n${userName}`
    });
  }

  // ... continue for other fields (status, priority, etc.)

  // Translate button text
  const buttonText = i18n.t('external.slack.viewTask');

  return {
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: title }
      },
      // ... rest of blocks
      {
        type: "actions",
        elements: [{
          type: "button",
          text: { type: "plain_text", text: buttonText },
          url: taskUrl
        }]
      }
    ]
  };
}
```

#### 5.2.3 Refactor formatTeamsMessage

Apply same pattern to Teams message formatting (lines 270-376):

```typescript
private static formatTeamsMessage(
  notificationType: string,
  taskData: any,
  userName: string,
  locale: string  // NEW parameter
): any {
  const i18n = I18nHelper.getI18nInstance(locale);

  const titleKey = `external.teams.${notificationType}.title`;
  const title = i18n.t(titleKey, { defaultValue: 'Notification' });

  const facts: any[] = [
    {
      title: i18n.t('external.teams.task'),
      value: taskData.task_name
    },
    {
      title: i18n.t('external.teams.project'),
      value: taskData.project_name
    }
  ];

  // ... continue for other facts

  // ... rest of adaptive card structure
}
```

#### 5.2.4 Update All Callers

Find all places that call `sendExternalNotifications` and pass the `userId`:

Example:
```typescript
await ExternalNotificationsService.sendExternalNotifications(
  projectId,
  taskId,
  'task_assigned',
  reporterName,
  reporterId,  // NEW: Pass user ID
  additionalData
);
```

---

## Phase 6: Create Backend Translation Files

### 6.1 English Translation File (Master)
**File**: `/worklenz-backend/locales/en/notifications.json`

```json
{
  "taskAssigned": "<b>{{reporter}}</b> has assigned you in <b>{{task}}</b>",
  "taskRemoved": "<b>{{reporter}}</b> has removed you from <b>{{task}}</b>",
  "taskAdded": "<b>{{user}}</b> added \"<b>{{task}}</b>\" to the \"<b>{{project}}</b>\"",
  "taskRemovedFromProject": "<b>{{user}}</b> removed \"<b>{{task}}</b>\" from the \"<b>{{project}}</b>\"",
  "teamRemoval": "You have been removed from <b>{{team}}</b> by <b>{{user}}</b>",
  "addedToProject": "You have been added to the <b>{{project}}</b> Project in <b>{{team}}</b> Team",
  "commentAdded": "<b>{{user}}</b> commented on <b>{{task}}</b>",
  "mentionedInComment": "<b>{{user}}</b> mentioned you in a comment on <b>{{task}}</b>",
  "addedToTeam": "You have been added to <b>{{team}}</b>",
  "removedFromTeam": "You have been removed from <b>{{team}}</b> by <b>{{user}}</b>"
}
```

### 6.2 Generate Translations for Other Languages

Use DeepL API or Google Translate to translate the English file to:
- German (de)
- Spanish (es)
- Portuguese (pt)
- Albanian (alb)
- Chinese (zh)

**Important**: After machine translation, have native speakers review for:
- HTML tag preservation (`<b>`, `</b>`)
- Parameter placeholder preservation (`{{user}}`, `{{task}}`, etc.)
- Natural language flow
- Technical accuracy

---

## Testing & Verification

### 1. Unit Tests

Create test files for new utilities:

**Backend**: `/worklenz-backend/tests/i18n-helper.test.ts`
```typescript
describe('I18nHelper', () => {
  it('should fetch user language from database', async () => {
    const lang = await I18nHelper.getUserLanguage('user-123');
    expect(lang).toBe('de');
  });

  it('should translate notification message', () => {
    const result = I18nHelper.translate(
      'notifications.taskAssigned',
      'de',
      { reporter: 'John', task: 'Fix bug' }
    );
    expect(result).toContain('John');
    expect(result).toContain('Fix bug');
  });
});
```

**Frontend**: `/worklenz-frontend/src/utils/__tests__/notification-message-renderer.test.tsx`
```typescript
describe('renderNotificationMessage', () => {
  it('should render new format with translation key', () => {
    const notification = {
      message_key: 'notifications.taskAssigned',
      message_params: { reporter: 'Alice', task: 'Deploy app' }
    };

    const result = renderNotificationMessage(notification, t);
    expect(result).toContain('Alice');
    expect(result).toContain('Deploy app');
  });

  it('should render legacy format with raw message', () => {
    const notification = {
      message: '<b>John</b> has assigned you'
    };

    const result = renderNotificationMessage(notification, t);
    expect(result).toContain('John');
  });
});
```

### 2. Integration Tests

**Test Scenario 1: Task Assignment Notification**
1. User A (English) assigns task to User B (German)
2. Verify database stores `message_key` and `message_params`
3. Verify User B receives notification in German via socket
4. Verify User B sees German text in frontend UI
5. Verify backward compatibility: Old notifications still display

**Test Scenario 2: External Integration**
1. Configure Slack webhook for project
2. User A (Spanish) assigns task
3. Verify Slack notification sent in Spanish
4. Check all field labels are translated

**Test Scenario 3: Language Switching**
1. User changes language preference from English to German
2. Reload notifications drawer
3. Verify unread notifications display in German
4. Verify new notifications arrive in German

### 3. Manual Testing Checklist

- [ ] Change user language in settings
- [ ] Trigger task assignment notification
- [ ] Verify notification drawer shows translated text
- [ ] Verify real-time socket notification is translated
- [ ] Trigger comment notification
- [ ] Verify mention notification
- [ ] Check Slack integration (if available)
- [ ] Check Teams integration (if available)
- [ ] Test with all 6 supported languages
- [ ] Verify HTML tags render correctly (bold, italic)
- [ ] Test XSS protection (inject script tags in task/user names)
- [ ] Verify backward compatibility (old notifications still render)

### 4. Performance Testing

- [ ] Load 100+ notifications, verify render time < 500ms
- [ ] Test database query performance with new columns
- [ ] Monitor socket emission latency
- [ ] Check i18n translation lookup performance
- [ ] Verify no memory leaks from i18n instances

### 5. Translation Quality Review

For each language:
- [ ] Native speaker review all notification strings
- [ ] Verify parameter interpolation works correctly
- [ ] Check plural forms (if applicable)
- [ ] Verify professional tone
- [ ] Ensure HTML tags preserved

---

## Rollout Strategy

### Phase 1: Development & Testing (Week 1-2)
- Implement all code changes
- Write unit tests
- Manual testing across languages
- Translation review

### Phase 2: Staging Deployment (Week 3)
- Deploy to staging environment
- QA team testing
- Fix bugs
- Translation refinement

### Phase 3: Canary Release (Week 4)
- Enable for 10% of users via feature flag
- Monitor error rates in Sentry/logging
- Gather user feedback
- Fix critical issues

### Phase 4: Gradual Rollout (Week 5)
- Expand to 50% of users
- Monitor performance metrics
- Address feedback
- Final translation polish

### Phase 5: Full Release (Week 6)
- Enable for 100% of users
- Monitor for 1 week
- Document known issues
- Plan cleanup phase

### Phase 6: Cleanup (Week 8+)
- Remove feature flags
- Archive migration code
- (Future) Drop old `message` column after 3+ months

---

## Critical Files Summary

### New Files to Create:
1. `/worklenz-backend/src/config/i18n.ts` - Backend i18n configuration
2. `/worklenz-backend/src/shared/i18n-helper.ts` - Translation helper service
3. `/worklenz-frontend/src/utils/notification-message-renderer.tsx` - Frontend message renderer
4. `/worklenz-backend/database/migrations/add_notification_translation_support.sql` - Database migration
5. `/worklenz-backend/locales/{lang}/notifications.json` - Backend notification translations (6 languages)
6. `/worklenz-backend/locales/{lang}/external.json` - External integration translations (6 languages)
7. `/worklenz-frontend/public/locales/{lang}/notifications.json` - Frontend notification translations (6 languages, may already exist - update)

### Files to Modify:
1. `/worklenz-backend/database/sql/4_functions.sql` - Update notification functions to use translation keys
2. `/worklenz-backend/src/services/notifications/notifications.service.ts` - Add translation support
3. `/worklenz-backend/src/services/external-notifications.service.ts` - Localize Slack/Teams messages
4. `/worklenz-frontend/src/components/navbar/notifications/notifications-drawer/notification/invitation-item.tsx` - Fix hardcoded strings
5. `/worklenz-frontend/src/components/navbar/notifications/notifications-drawer/notification/notfication-drawer.tsx` - Fix hardcoded strings
6. `/worklenz-frontend/src/components/navbar/notifications/notifications-drawer/notification/notification-template.tsx` - Use message renderer
7. `/worklenz-frontend/public/locales/{lang}/navbar.json` - Add missing notification drawer keys (6 languages)
8. `/worklenz-backend/src/services/notifications/messages/TaskAdd.ts` - Refactor to use translation keys
9. `/worklenz-backend/src/services/notifications/messages/TaskRemove.ts` - Refactor to use translation keys
10. `/worklenz-backend/src/index.ts` or `/worklenz-backend/src/app.ts` - Initialize i18n on startup

---

## Success Criteria

✅ All notification types support all 6 languages (en, de, es, pt, alb, zh)
✅ Zero hardcoded notification strings in database functions
✅ Frontend notification drawer fully localized
✅ Slack/Teams notifications use triggering user's locale
✅ Backward compatibility: existing notifications still render correctly
✅ Zero XSS vulnerabilities in translated content
✅ Translation quality reviewed by native speakers
✅ Performance remains within 10% of baseline
✅ All tests passing (unit + integration)
✅ Email notifications remain unchanged (out of scope for this phase)

---

## Notes

- Email notifications are intentionally excluded from this phase
- Machine translation will be used initially with native speaker review
- Backward compatibility maintained - existing notifications continue to work
- External integrations (Slack/Teams) will use the triggering Worklenz user's locale
- The `message` column in `user_notifications` table will be kept for backward compatibility and can be dropped in a future cleanup phase (3+ months after full rollout)
