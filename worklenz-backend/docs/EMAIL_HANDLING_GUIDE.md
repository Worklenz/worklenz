# Email Handling Best Practices

## Overview

This document outlines how email addresses are handled throughout the Worklenz application to ensure case-insensitive behavior and prevent duplicate accounts.

## Core Principle: Defense in Depth

Email addresses are normalized at **multiple layers** to ensure consistency:

1. **Application Layer** - JavaScript/TypeScript normalization
2. **Database Function Layer** - SQL function normalization
3. **Database Trigger Layer** - Automatic normalization on INSERT/UPDATE
4. **Query Layer** - Case-insensitive comparisons using LOWER()

## Email Normalization Strategy

### Why Lowercase?

According to RFC 5321/5322:
- **Local part** (before @): Technically case-sensitive
- **Domain part** (after @): Case-insensitive
- **Real-world practice**: 99.9% of email providers treat emails as case-insensitive

**Examples:**
- `Kalinga@gmail.com` = `kalinga@gmail.com` (Gmail)
- `User@outlook.com` = `user@outlook.com` (Outlook)
- `Admin@company.com` = `admin@company.com` (Most corporate mail servers)

### Normalization Process

All emails are transformed using:
```javascript
const normalizedEmail = email.toLowerCase().trim();
```

## Implementation Points

### 1. User Signup

**File:** `src/passport/passport-strategies/passport-local-signup.ts`

```typescript
// Line 44
email: email.toLowerCase().trim()
```

**Database Function:** `register_user()` in `database/sql/4_functions.sql`

```sql
-- Line 5008
_trimmed_email = LOWER(TRIM((_body ->> 'email')));

-- Line 5013 - Duplicate check (case-insensitive)
IF EXISTS(SELECT email FROM users WHERE LOWER(email) = _trimmed_email)
```

**Checks performed:**
- ✅ Google account check (case-insensitive)
- ✅ Deactivated account check (case-insensitive)
- ✅ Duplicate email check (case-insensitive)
- ✅ Email invitation validation (case-insensitive)

### 2. User Login

**File:** `src/passport/passport-strategies/passport-local-login.ts`

```typescript
// Line 20
const normalizedEmail = email.toLowerCase().trim();

// Line 24
WHERE LOWER(email) = $1
```

### 3. Password Reset

**File:** `src/controllers/auth-controller.ts`

```typescript
// Line 118
const normalizedEmail = email ? email.toLowerCase().trim() : null;

// Line 120
WHERE LOWER(email) = $1
```

### 4. Google/OAuth Signup

**File:** `database/sql/4_functions.sql` - `register_google_user()`

```sql
-- Line 4934
_email = LOWER(TRIM((_body ->> 'email')::TEXT));
```

### 5. Team Invitations

**File:** `src/controllers/teams-controller.ts`

```typescript
// Line 64 - Get team invites (case-insensitive)
WHERE LOWER(email) = LOWER((SELECT email FROM users WHERE id = $1))
```

**File:** `database/sql/4_functions.sql` - `create_team_member()`

```sql
-- Line 1207 - Normalize email before processing
_email = LOWER(TRIM('"' FROM _email)::TEXT);
```

### 6. Notifications

**File:** `src/controllers/notification-controller.ts`

```typescript
// Line 69 - Count invitations (case-insensitive)
WHERE LOWER(email) = LOWER((SELECT email FROM users WHERE id = $1))
```

### 7. Reporting

**File:** `src/controllers/reporting/reporting-members-controller.ts`

```typescript
// Line 818 - Member reporting (case-insensitive)
WHERE LOWER(email) = LOWER((SELECT email FROM team_member_info_view...))
```

## Database Layer

### Triggers

**File:** `database/sql/triggers.sql`

```sql
CREATE OR REPLACE FUNCTION lower_email() RETURNS TRIGGER AS
$$
BEGIN
    IF (is_null_or_empty(NEW.email) IS FALSE)
    THEN
        NEW.email = LOWER(TRIM(NEW.email));
    END IF;
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Applied to:
CREATE TRIGGER users_email_lower BEFORE INSERT OR UPDATE ON users;
CREATE TRIGGER email_invitations_email_lower BEFORE INSERT OR UPDATE ON email_invitations;
```

### Domain Type

**File:** `database/sql/1_tables.sql`

```sql
CREATE DOMAIN WL_EMAIL AS TEXT
CHECK (value ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
```

## Migration for Existing Data

**File:** `database/migrations/20251211000001-lowercase-existing-user-emails.sql`

This migration normalizes all existing emails that were created before triggers were applied:

```sql
UPDATE users
SET email = LOWER(TRIM(email))
WHERE email != LOWER(TRIM(email));

UPDATE email_invitations
SET email = LOWER(TRIM(email))
WHERE email != LOWER(TRIM(email));
```

## Email Delivery

### IMPORTANT: No Impact on Email Delivery

Lowercasing emails does NOT affect email delivery:

**Email Service:** AWS SES (Amazon Simple Email Service)
- ✅ Handles lowercase emails perfectly
- ✅ Mail servers deliver based on case-insensitive matching
- ✅ No delivery failures due to case changes

**Example:**
```
User signs up: Kalinga@ceydigital.com
Stored as:     kalinga@ceydigital.com
Email sent to: kalinga@ceydigital.com
Delivered to:  Kalinga@ceydigital.com ✅ SUCCESS
```

## Testing Queries

### Find Users with Mixed-Case Emails

```sql
SELECT id, email, name, created_at
FROM users
WHERE email != LOWER(email)
ORDER BY created_at DESC;
```

### Find Invitation Mismatches

```sql
SELECT
    u.id AS user_id,
    u.email AS user_email,
    ei.email AS invitation_email,
    ei.team_id,
    (SELECT name FROM teams WHERE id = ei.team_id) AS team_name
FROM users u
INNER JOIN email_invitations ei ON LOWER(u.email) = LOWER(ei.email)
WHERE u.email != ei.email
ORDER BY ei.created_at DESC;
```

## Checklist for New Features

When adding new email-related features, ensure:

- [ ] Email is normalized at entry point: `email.toLowerCase().trim()`
- [ ] Database queries use case-insensitive comparison: `WHERE LOWER(email) = LOWER($1)`
- [ ] Email validation uses existing utility: `isValidateEmail(email)`
- [ ] Duplicate checks are case-insensitive
- [ ] Error messages use the original (user-provided) email, not the normalized one
- [ ] Email sending uses the normalized email address

## Common Patterns

### ✅ CORRECT: Case-Insensitive Query

```typescript
const normalizedEmail = email.toLowerCase().trim();
const query = `SELECT * FROM users WHERE LOWER(email) = $1`;
await db.query(query, [normalizedEmail]);
```

### ❌ INCORRECT: Case-Sensitive Query

```typescript
// DON'T DO THIS - may miss matches with different casing
const query = `SELECT * FROM users WHERE email = $1`;
await db.query(query, [email]);
```

### ✅ CORRECT: Duplicate Check

```sql
-- In database functions
IF EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER(_email))
```

### ❌ INCORRECT: Duplicate Check

```sql
-- DON'T DO THIS - may allow duplicate accounts
IF EXISTS(SELECT 1 FROM users WHERE email = _email)
```

## Related Files

| Category | File | Purpose |
|----------|------|---------|
| **Signup** | `passport-strategies/passport-local-signup.ts` | User registration flow |
| **Login** | `passport-strategies/passport-local-login.ts` | User authentication |
| **Auth** | `controllers/auth-controller.ts` | Password reset, OAuth |
| **Invitations** | `controllers/teams-controller.ts` | Team invitations |
| **Notifications** | `controllers/notification-controller.ts` | Notification counts |
| **Database** | `database/sql/4_functions.sql` | Core SQL functions |
| **Triggers** | `database/sql/triggers.sql` | Email normalization triggers |
| **Migrations** | `database/migrations/20251211000001-*` | Data normalization |

## Support

For questions or issues related to email handling, please refer to:
- GitHub Issues: https://github.com/Worklenz/worklenz/issues
- Documentation: This file

---

**Last Updated:** 2025-12-11
**Maintained By:** Worklenz Engineering Team
