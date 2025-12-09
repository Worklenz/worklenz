# Slack Integration Security Setup

## Overview

The Slack integration has been implemented with enterprise-grade security features including:
- ✅ Encrypted token storage (AES-256-GCM)
- ✅ Input validation on all endpoints
- ✅ Authorization checks
- ✅ Rate limiting
- ✅ Audit logging
- ✅ SQL injection prevention (parameterized queries + transactions)

## Critical: Environment Setup

### 1. Encryption Key Configuration

**Before deploying to production**, you **MUST** set up encryption keys:

```bash
# Generate a secure 256-bit encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to your .env file:
ENCRYPTION_KEY=<your-generated-key-here>
ENCRYPTION_SALT=<your-unique-salt-here>
```

⚠️ **IMPORTANT**:
- **NEVER** commit these keys to git
- Store them in a secure key management service (AWS KMS, HashiCorp Vault, etc.) in production
- Rotate keys periodically
- If keys are compromised, all Slack tokens must be re-authenticated

### 2. Database Migration

Run the Slack integration migration:

```bash
# Apply the migration
psql -U your_user -d worklenz_db -f worklenz-backend/database/migrations/20250130000001-create-slack-integration.sql
```

This creates the following tables:
- `slack_workspaces` - Stores encrypted Slack workspace credentials
- `slack_users` - Maps Slack users to Worklenz users
- `slack_channels` - Stores available Slack channels
- `slack_channel_configs` - Project-to-channel mappings
- `slack_notifications` - Notification delivery log
- `slack_audit_log` - Security audit trail

## Security Features

### 1. Token Encryption

All Slack access tokens are encrypted using AES-256-GCM before storage:

```typescript
// Tokens are encrypted automatically
const workspace = await SlackService.connectWorkspace(orgId, slackData, userId);

// Tokens are never exposed in API responses
// Only decrypted internally when needed for Slack API calls
```

**Storage Format**: `iv:authTag:encryptedData` (all hex encoded)

### 2. Input Validation

All endpoints validate input using dedicated validators:

- `slackOAuthValidator` - Validates OAuth responses
- `channelSyncValidator` - Validates channel data
- `channelConfigValidator` - Validates project configurations
- `testNotificationValidator` - Validates notification payloads

Example validation error:
```json
{
  "done": false,
  "message": "team_id is required and must be a string, access_token is too long",
  "body": null
}
```

### 3. Authorization Checks

Every operation verifies ownership:

```typescript
// Verify user owns the workspace
const hasAccess = await SlackService.verifyWorkspaceOwnership(workspaceId, organizationId);
if (!hasAccess) {
  return res.status(403).send(new ServerResponse(false, null, "Forbidden"));
}
```

**Endpoints with authorization**:
- ✅ Disconnect workspace
- ✅ Sync channels
- ✅ Get channels
- ✅ Delete channel config
- ✅ Send test notification

### 4. Rate Limiting

**Global Slack rate limits**:
- 100 requests per 15 minutes
- Applies to all Slack endpoints

**Test notification rate limits**:
- 5 requests per minute
- Prevents spam and abuse

Rate limit response:
```json
{
  "done": false,
  "message": "Too many Slack API requests. Please try again later.",
  "body": null
}
```

### 5. Audit Logging

All critical operations are logged to `slack_audit_log`:

```sql
SELECT * FROM slack_audit_log
WHERE organization_id = 'xxx'
ORDER BY created_at DESC;
```

**Logged actions**:
- `SLACK_WORKSPACE_CONNECTED`
- `SLACK_WORKSPACE_DISCONNECTED`
- (More can be added as needed)

**Audit log fields**:
- `action` - What happened
- `user_id` - Who did it
- `organization_id` - Which organization
- `details` - Additional context (JSON)
- `ip_address` - Where from (optional)
- `user_agent` - Client info (optional)
- `created_at` - When it happened

### 6. SQL Injection Prevention

All database queries use:
- ✅ Parameterized queries (prevents SQL injection)
- ✅ Transactions for multi-step operations
- ✅ Proper error handling and rollback

Example:
```typescript
const client: PoolClient = await db.connect();
try {
  await client.query('BEGIN');
  await client.query('DELETE FROM slack_channels WHERE slack_workspace_id = $1', [workspaceId]);
  // ... more operations
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

## API Endpoints

### Workspace Management

```
POST   /api/v1/slack/workspace/connect       - Connect Slack workspace
GET    /api/v1/slack/workspace                - Get connected workspace
DELETE /api/v1/slack/workspace/:workspaceId  - Disconnect workspace
```

### Channel Management

```
POST   /api/v1/slack/workspace/:workspaceId/channels/sync  - Sync channels
GET    /api/v1/slack/workspace/:workspaceId/channels       - Get channels (paginated)
```

### Channel Configurations

```
POST   /api/v1/slack/channel-configs                       - Create config
GET    /api/v1/slack/channel-configs/project/:projectId    - Get project configs
GET    /api/v1/slack/channel-configs/organization          - Get all configs
DELETE /api/v1/slack/channel-configs/:configId             - Delete config
```

### Testing

```
POST   /api/v1/slack/test-notification/:configId           - Send test notification
```

## Production Checklist

Before going to production:

- [ ] Set `ENCRYPTION_KEY` environment variable
- [ ] Set `ENCRYPTION_SALT` environment variable
- [ ] Run database migrations
- [ ] Test encryption/decryption works
- [ ] Verify rate limiting is active
- [ ] Test authorization on all endpoints
- [ ] Configure Slack OAuth app
- [ ] Set up monitoring for `slack_audit_log`
- [ ] Set up alerts for failed encryption/decryption
- [ ] Review and adjust rate limits based on usage
- [ ] Implement actual Slack Web API calls (currently placeholder)
- [ ] Add IP address and user agent capture to audit logs
- [ ] Set up log rotation for `slack_audit_log`

## Monitoring & Alerts

### Recommended Monitors

1. **Failed Decryption Attempts**
```sql
SELECT COUNT(*) FROM slack_audit_log
WHERE details->>'error' LIKE '%decrypt%'
AND created_at > NOW() - INTERVAL '1 hour';
```

2. **Workspace Disconnections**
```sql
SELECT * FROM slack_audit_log
WHERE action = 'SLACK_WORKSPACE_DISCONNECTED'
AND created_at > NOW() - INTERVAL '24 hours';
```

3. **Rate Limit Hits**
- Monitor for 429 responses
- Alert if sustained high rate limit violations

4. **Failed Notifications**
```sql
SELECT COUNT(*) FROM slack_notifications
WHERE status = 'failed'
AND created_at > NOW() - INTERVAL '1 hour';
```

## Security Best Practices

1. **Key Management**
   - Use a dedicated key management service (KMS)
   - Rotate encryption keys quarterly
   - Keep backups of old keys for data recovery

2. **Access Control**
   - Only admin users can configure Slack integration
   - Regular access reviews

3. **Audit Reviews**
   - Review audit logs weekly
   - Investigate any suspicious activity
   - Set up automated alerts for unusual patterns

4. **Data Retention**
   - Slack tokens are never logged
   - Audit logs retained for 90 days (configurable)
   - Failed notifications logged for debugging

## Troubleshooting

### Encryption Errors

**Error**: `ENCRYPTION_KEY environment variable is not set`
**Fix**: Set the environment variable as described above

**Error**: `Decryption failed - data may be corrupted or key is incorrect`
**Fix**:
- Verify the encryption key hasn't changed
- Check if data was encrypted with a different key
- May need to re-authenticate Slack workspace

### Authorization Errors

**Error**: `Forbidden: You do not have access to this workspace`
**Fix**: Verify the user's organization_id matches the workspace's organization_id

### Rate Limiting

**Error**: `Too many Slack API requests`
**Fix**: Wait for the rate limit window to reset (15 minutes)

## Future Enhancements

1. **Implement actual Slack Web API integration**
   - Install `@slack/web-api` package
   - Replace placeholder in `SlackService.sendNotification()`

2. **Add more audit events**
   - Channel config created/updated
   - Notification sent
   - Permission changes

3. **Enhanced monitoring**
   - Capture IP address and user agent
   - Add request/response logging
   - Performance metrics

4. **Key rotation**
   - Implement automated key rotation
   - Re-encrypt data with new keys

5. **Multi-workspace support**
   - Allow connecting multiple Slack workspaces
   - Workspace selection UI

## Support

For security concerns or questions:
- Review the code in `/services/encryption.service.ts`
- Check audit logs in `slack_audit_log` table
- Contact the security team

---

**Last Updated**: 2025-01-30
**Version**: 1.0.0
