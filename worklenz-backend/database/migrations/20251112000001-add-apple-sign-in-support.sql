-- =====================================================
-- Migration: Add Apple Sign-In Support to Worklenz
-- Date: 2025-11-12
-- Description: Adds apple_id column to users table for Apple OAuth authentication
-- Author: Worklenz Development Team
-- =====================================================

-- Add apple_id column to users table
-- This column stores Apple's unique user identifier (sub claim from Apple ID token)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS apple_id TEXT;

-- Create index for apple_id lookups (performance optimization)
-- This index improves query performance when looking up users by apple_id
CREATE INDEX IF NOT EXISTS idx_users_apple_id ON users(apple_id);

-- Add comment for documentation
COMMENT ON COLUMN users.apple_id IS 'Apple unique user identifier (sub claim from Apple ID token). Used for Apple Sign-In OAuth authentication.';

-- Verify the column was added successfully
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'apple_id'
    ) THEN
        RAISE NOTICE '✓ apple_id column successfully added to users table';
    ELSE
        RAISE EXCEPTION '✗ Failed to add apple_id column to users table';
    END IF;
END $$;

-- Verify the index was created successfully
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'users' 
        AND indexname = 'idx_users_apple_id'
    ) THEN
        RAISE NOTICE '✓ Index idx_users_apple_id successfully created';
    ELSE
        RAISE EXCEPTION '✗ Failed to create index idx_users_apple_id';
    END IF;
END $$;

-- =====================================================
-- Rollback Instructions (if needed):
-- =====================================================
-- To rollback this migration, run:
-- DROP INDEX IF EXISTS idx_users_apple_id;
-- ALTER TABLE users DROP COLUMN IF EXISTS apple_id;
-- 
-- WARNING: Only rollback if no users have signed in with Apple yet!
-- =====================================================
