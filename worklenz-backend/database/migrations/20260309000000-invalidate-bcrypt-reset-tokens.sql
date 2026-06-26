-- Migration: Invalidate legacy bcrypt-based password reset tokens
-- Date: 2026-03-09
-- Description: The password reset system now uses random hex tokens with SHA-256 hashing.
--              Old tokens stored as bcrypt hashes (starting with '$2b$') are incompatible
--              with the new lookup mechanism and must be marked as used.

BEGIN;

-- Mark all existing bcrypt-style tokens as used so they cannot be replayed.
-- New tokens are 64-char hex strings; old ones start with '$2b$'.
UPDATE password_reset_tokens
SET is_used = TRUE, used_at = NOW()
WHERE is_used = FALSE
  AND token_hash LIKE '$2b$%';

COMMIT;
