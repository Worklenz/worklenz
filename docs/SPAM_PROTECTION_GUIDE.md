# Worklenz Spam Protection System Guide

## Overview

This guide documents the spam protection system implemented in Worklenz to prevent abuse of user invitations and registrations.

## System Components

### 1. Spam Detection (`/worklenz-backend/src/utils/spam-detector.ts`)

The core spam detection engine that analyzes text for suspicious patterns:

- **Flag-First Policy**: Suspicious content is flagged for review, not blocked
- **Selective Blocking**: Only extremely obvious spam (score > 80) gets blocked
- **URL Detection**: Identifies links, shortened URLs, and suspicious domains
- **Spam Phrases**: Detects common spam tactics (urgent, click here, win prizes)
- **Cryptocurrency Spam**: Identifies blockchain/crypto compensation scams
- **Formatting Issues**: Excessive capitals, special characters, emojis
- **Fake Name Detection**: Generic names (test, demo, fake, spam)
- **Whitelist Support**: Legitimate business names bypass all checks
- **Context-Aware**: Smart detection reduces false positives

### 2. Rate Limiting (`/worklenz-backend/src/middleware/rate-limiter.ts`)

Prevents volume-based attacks:

- **Invite Limits**: 5 invitations per 15 minutes per user
- **Organization Creation**: 3 attempts per hour
- **In-Memory Store**: Fast rate limit checking without database queries

### 3. Frontend Validation

Real-time feedback as users type:

- `/worklenz-frontend/src/components/account-setup/organization-step.tsx`
- `/worklenz-frontend/src/components/admin-center/overview/organization-name/organization-name.tsx`
- `/worklenz-frontend/src/components/settings/edit-team-name-modal.tsx`

### 4. Backend Enforcement

Blocks spam at API level:

- **Team Members Controller**: Validates organization/owner names before invites
- **Signup Process**: Blocks spam during registration
- **Logging**: All blocked attempts sent to Slack via winston logger

### 5. Database Schema

```sql
-- Teams table: Simple status field
ALTER TABLE teams ADD COLUMN status VARCHAR(20) DEFAULT 'active';

-- Moderation history tracking
CREATE TABLE team_moderation (
    id UUID PRIMARY KEY,
    team_id UUID REFERENCES teams(id),
    status VARCHAR(20), -- 'flagged', 'suspended', 'restored'
    reason TEXT,
    moderator_id UUID,
    created_at TIMESTAMP,
    expires_at TIMESTAMP -- For temporary suspensions
);

-- Spam detection logs
CREATE TABLE spam_logs (
    id UUID PRIMARY KEY,
    team_id UUID,
    content_type VARCHAR(50),
    original_content TEXT,
    spam_score INTEGER,
    spam_reasons JSONB,
    action_taken VARCHAR(50)
);
```

## Admin Tools

### API Endpoints

```
GET  /api/moderation/flagged-organizations - View flagged teams
POST /api/moderation/flag-organization - Manually flag a team
POST /api/moderation/suspend-organization - Suspend a team
POST /api/moderation/unsuspend-organization - Restore a team
GET  /api/moderation/scan-spam - Scan for spam in existing data
GET  /api/moderation/stats - View moderation statistics
POST /api/moderation/bulk-scan - Bulk scan and auto-flag
```

## Slack Notifications

The system sends structured alerts to Slack for:

- 🚨 **Spam Detected** (score > 30)
- 🔥 **High Risk Content** (known spam domains)
- 🛑 **Blocked Attempts** (invitations/signups)
- ⚠️ **Rate Limit Exceeded**

Example Slack notification:
```json
{
  "alert_type": "high_risk_content",
  "team_name": "CLICK LINK: gclnk.com/spam",
  "user_email": "spammer@example.com",
  "spam_score": 95,
  "reasons": ["Contains suspicious URLs", "Contains monetary references"],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Testing the System

### Test Spam Patterns

These will be **FLAGGED** for review (flag-first approach):

1. **Suspicious Words**: "Free Software Solutions" (flagged but allowed)
2. **URLs**: "Visit our site: bit.ly/win-prize" (flagged but allowed)
3. **Cryptocurrency**: "🔔 $50,000 BLOCKCHAIN COMPENSATION" (flagged but allowed)
4. **Urgency**: "URGENT! Click here NOW!!!" (flagged but allowed)
5. **Generic Names**: "Test Company", "Demo Organization" (flagged but allowed)
6. **Excessive Numbers**: "Company12345" (flagged but allowed)
7. **Single Emoji**: "Great Company 💰" (flagged but allowed)

### BLOCKED Patterns (zero-tolerance - score > 80):

1. **Known Spam Domains**: "CLICK LINK: gclnk.com/spam"
2. **Extreme Scam Patterns**: "🔔CHECK $213,953 BLOCKCHAIN COMPENSATION URGENT🔔"
3. **Obvious Spam URLs**: Content with bit.ly/scam patterns

### Whitelisted (Will NOT be flagged):

1. **Legitimate Business**: "Microsoft Corporation", "Free Software Company"
2. **Standard Suffixes**: "ABC Solutions Inc", "XYZ Consulting LLC" 
3. **Tech Companies**: "DataTech Services", "The Design Studio"
4. **Context-Aware**: "Free Range Marketing", "Check Point Systems"
5. **Legitimate "Test"**: "TestDrive Automotive" (not generic)

### Expected Behavior

1. **Suspicious Signup**: Flagged in logs, user allowed to proceed
2. **Obvious Spam Signup**: Blocked with user-friendly message
3. **Suspicious Invitations**: Flagged in logs, invitation sent
4. **Obvious Spam Invitations**: Blocked with support contact suggestion
5. **Frontend**: Shows warning message for suspicious content
6. **Logger**: Sends Slack notification for all suspicious activity
7. **Database**: Records all activity in spam_logs table

## Database Migration

Run these SQL scripts in order:

1. `spam_protection_tables.sql` - Creates new schema
2. `fix_spam_protection_constraints.sql` - Fixes notification_settings constraints

## Configuration

### Environment Variables

No additional environment variables required. The system uses existing:
- `COOKIE_SECRET` - For session management
- Database connection settings

### Adjusting Thresholds

In `spam-detector.ts`:
```typescript
const isSpam = score >= 50; // Adjust threshold here
```

In `rate-limiter.ts`:
```typescript
inviteRateLimit(5, 15 * 60 * 1000) // 5 requests per 15 minutes
```

## Monitoring

### Check Spam Statistics
```sql
SELECT * FROM moderation_dashboard;
SELECT COUNT(*) FROM spam_logs WHERE created_at > NOW() - INTERVAL '24 hours';
```

### View Rate Limit Events
```sql
SELECT * FROM rate_limit_log WHERE blocked = true ORDER BY created_at DESC;
```

## Troubleshooting

### Issue: Legitimate users blocked

1. Check spam_logs for their content
2. Adjust spam patterns or scoring threshold
3. Whitelist specific domains if needed

### Issue: Notification settings error during signup

Run the fix script: `fix_spam_protection_constraints.sql`

### Issue: Slack notifications not received

1. Check winston logger configuration
2. Verify log levels in `logger.ts`
3. Ensure Slack webhook is configured

## Future Enhancements

1. **Machine Learning**: Train on spam_logs data
2. **IP Blocking**: Geographic or reputation-based blocking
3. **CAPTCHA Integration**: For suspicious signups
4. **Email Verification**: Stronger email validation
5. **Allowlist Management**: Pre-approved domains

## Security Considerations

- Logs contain sensitive data - ensure proper access controls
- Rate limit data stored in memory - consider Redis for scaling
- Spam patterns should be regularly updated
- Monitor for false positives and adjust accordingly