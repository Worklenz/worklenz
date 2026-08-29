-- Migration: Fix tasks_name_check constraint from 500 to 250 characters
-- Date: 2026-07-28
-- Problem: The tasks_name_check constraint was set to 500 characters max,
--          but the business requirement is 250 characters max
-- Solution: Drop the old constraint and create a new one with 250 character limit

BEGIN;

-- Drop the old constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_name_check;

-- Create new constraint with 250 character limit
ALTER TABLE tasks
    ADD CONSTRAINT tasks_name_check
        CHECK (CHAR_LENGTH(name) <= 250);

COMMIT;
