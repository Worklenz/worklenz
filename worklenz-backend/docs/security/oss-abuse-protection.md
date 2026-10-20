# OSS invitation and task-link protection

These controls run without a business license or private extensions. They do not
include SaaS trial seat limits, Worklenz incident heuristics, or Worklenz webhook
configuration. Existing authentication, authorization and CSRF checks still apply.

## Deployment and existing production databases

Run `npm run migrate:up` from `worklenz-backend` **before deploying the new application**.
Use the schema/function owner through `MIGRATION_DB_*` when the application role
has restricted privileges. Grant the application role SELECT on the blocklists
and invitation policy, and SELECT/INSERT/UPDATE on the counters and events if your
deployment does not already grant these through default privileges.

Migration `1792487961615_oss-invitation-security.js` uses `IF NOT EXISTS` for tables,
`CREATE OR REPLACE FUNCTION` and guarded recreation of its own triggers. It reuses
`blocked_signup_email_domains` and `blocked_task_content_hosts`; existing entries,
natural-key primary keys and operator policy values are preserved. Fresh tables
use UUID primary keys with `uuid_generate_v4()` defaults. The production blocklists
must expose `domain`/`host` and `active`, as the original hotfix schemas do.

Existing trial-specific triggers are not removed. Where those hotfix triggers
already exist, their restrictions continue alongside these OSS controls. Review
those deployment policies separately; this migration does not reset them. Legacy
hotfix rejection codes are also translated and recorded by the new error handler.

The down migration removes only this migration's guard triggers and functions.
It deliberately retains all policy tables, counters and security event history,
including pre-existing production blocklists. Roll back the application before
removing these functions. An up/down/up cycle preserves stored settings.

## Operator policies

New installations start with empty domain/host blocklists and a default limit of
100 invitations per workspace per hour, independent of subscription status.
Only database administrators manage these policies; no new public management API
is exposed.

```sql
-- Signup domains are exact matches. Store lowercase ASCII/punycode domains.
INSERT INTO blocked_signup_email_domains (domain, active)
VALUES ('unwanted-provider.example', TRUE)
ON CONFLICT (domain) DO UPDATE SET active = TRUE;

-- Block a known host and its subdomains in task descriptions.
INSERT INTO blocked_task_content_hosts (host, active)
VALUES ('malicious.example', TRUE)
ON CONFLICT (host) DO UPDATE SET active = TRUE;

UPDATE security_invitation_policy
SET max_per_window = 100, window_seconds = 3600
WHERE name = 'global';

-- Emergency pause applies even when max_per_window is zero (quota disabled).
UPDATE security_invitation_policy SET invitations_paused = TRUE WHERE name = 'global';
```

Signup checks run alongside the existing optional private policy. Public policy
lookup failures reject the signup operation rather than silently bypassing it.
Existing-account login is unchanged. Signup error messages use Accept-Language;
API/socket errors use the user's stored language. All eight backend locales have
translations and English fallbacks.

Invitation inserts (including team resends) reserve quota atomically in the same
transaction. Deleting invitation rows cannot reset it. Failed invitation batches
roll back their reservations. The shared email sender has an independent atomic
quota for outbound invitations, covering existing-member project invitations as
well. Each counter resets when its window expires. Failed email deliveries still
consume the outbound reservation. Counters are bounded to two rows per workspace.

The task-description trigger covers inserts and description updates from HTTP,
Socket.IO, imports and database functions. It matches HTTP(S)/protocol-relative
URL authorities, not unrelated path/query text. It handles case, trailing dots,
credentials, ports, subdomains, ASCII numeric HTML entities and percent escapes.
This targeted known-host filter is not a full browser URL parser or a phishing
classifier: Unicode/IDNA variants, redirects and unlisted hosts need additional
operator policy and monitoring. Existing descriptions are not automatically
rewritten or removed.

## Errors and alerts

The API keeps the `ServerResponse` shape and returns `done: false`, a translated
`message`, and `body.error_code` for these explicit policy errors:

| HTTP status | error_code | Meaning |
| --- | --- | --- |
| 400 | blockedTaskHost | A task description contains a blocked host |
| 403 | invitationsPaused | The operator paused invitations |
| 429 | invitationLimit | The workspace quota was exhausted |

The description-change socket acknowledges failure with the translated message
and does not broadcast a successful update. Invitation emails already queued by
application code are checked immediately before sending; if blocked, the email
is suppressed and an event is recorded. Some existing invitation endpoints send
asynchronously, so their successful membership response does not guarantee email
delivery.

Handled HTTP/socket rejections and sender-side quota failures write to
`security_events` outside the rejected statement's transaction. Direct SQL clients
receive the database error; their failures are not automatically recorded by the
application. Events contain a code, workspace ID, timestamps and an hourly attempt
count, without recipient addresses or task content. Review them locally:

```sql
SELECT event_type, team_id, attempt_count, created_at, delivered_at
FROM security_events ORDER BY created_at DESC LIMIT 100;
```

Leave `SECURITY_ALERT_WEBHOOK_URL` empty for local-only alerts. To forward alerts,
configure an operator-owned HTTPS endpoint. It receives JSON `{id, code, teamId}`
at most once per workspace/code/hour. Requests have a three-second timeout and
never follow redirects. Failed delivery leaves `delivered_at` empty and emits a
redacted local diagnostic; delivery is best-effort and is not automatically
retried. Event persistence failure never permits a rejected operation. Apply an
operator retention policy to `security_events` as appropriate for your deployment.

## Verification

Unit tests cover localization, policy composition and alert privacy. Integration
tests apply/reapply/roll back the migration against both legacy blocklist schemas
and new tables, and exercise URL checks and concurrent quotas. Set an explicit
**disposable** database URL; tests never use application `DB_*` credentials:

```sh
TEST_SECURITY_DATABASE_URL=postgresql://localhost/disposable_test \
  npm test -- --runInBand --coverage=false --runTestsByPath \
  src/__tests__/oss-security-migration.integration.test.ts
```
