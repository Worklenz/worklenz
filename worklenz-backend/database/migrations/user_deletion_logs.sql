-- Create table for tracking user deletion requests
CREATE TABLE IF NOT EXISTS user_deletion_logs (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    user_id UUID NOT NULL,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    scheduled_deletion_date TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deletion_completed BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE user_deletion_logs
    ADD CONSTRAINT user_deletion_logs_pk
        PRIMARY KEY (id);

ALTER TABLE user_deletion_logs
    ADD CONSTRAINT user_deletion_logs_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_deletion_logs_user_id ON user_deletion_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_deletion_logs_scheduled_deletion ON user_deletion_logs(scheduled_deletion_date) WHERE NOT deletion_completed;

-- Add comment for documentation
COMMENT ON TABLE user_deletion_logs IS 'Tracks user account deletion requests and their scheduled deletion dates';
COMMENT ON COLUMN user_deletion_logs.scheduled_deletion_date IS 'Date when the user data should be permanently deleted (30 days after request)';
COMMENT ON COLUMN user_deletion_logs.deletion_completed IS 'Flag to indicate if the deletion process has been completed';