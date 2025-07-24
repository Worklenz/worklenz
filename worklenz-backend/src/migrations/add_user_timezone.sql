-- Add timezone column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_timezone ON users(timezone);

-- Update existing users to use their browser timezone (this would be done via application logic)
COMMENT ON COLUMN users.timezone IS 'IANA timezone identifier (e.g., America/New_York, Asia/Tokyo)';