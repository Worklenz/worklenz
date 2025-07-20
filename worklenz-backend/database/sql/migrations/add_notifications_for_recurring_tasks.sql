-- Create notifications table if it doesn't exist
CREATE TABLE IF NOT EXISTS notifications (
    id              UUID                     DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id         UUID                     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message         TEXT                     NOT NULL,
    data            JSONB,
    read            BOOLEAN                  DEFAULT FALSE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at         TIMESTAMP WITH TIME ZONE
);

-- Create user_push_tokens table if it doesn't exist (for future push notifications)
CREATE TABLE IF NOT EXISTS user_push_tokens (
    id              UUID                     DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id         UUID                     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    push_token      TEXT                     NOT NULL,
    device_type     VARCHAR(20),
    active          BOOLEAN                  DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, push_token)
);

-- Add notification preferences to users table if they don't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS in_app_notifications BOOLEAN DEFAULT TRUE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_id ON user_push_tokens(user_id);

-- Comments
COMMENT ON TABLE notifications IS 'In-app notifications for users';
COMMENT ON TABLE user_push_tokens IS 'Push notification tokens for mobile devices';
COMMENT ON COLUMN notifications.data IS 'Additional notification data in JSON format';
COMMENT ON COLUMN user_push_tokens.device_type IS 'Device type: ios, android, web';