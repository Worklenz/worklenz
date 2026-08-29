-- Create table for tracking message read status
CREATE TABLE IF NOT EXISTS client_portal_message_reads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES client_portal_chat_messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_portal_message_reads_message_id ON client_portal_message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_message_reads_user_id ON client_portal_message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_message_reads_read_at ON client_portal_message_reads(read_at);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON client_portal_message_reads TO worklenz_user;
GRANT SELECT ON client_portal_message_reads TO worklenz_client;

-- Add comments
COMMENT ON TABLE client_portal_message_reads IS 'Tracks when users read chat messages';
COMMENT ON COLUMN client_portal_message_reads.message_id IS 'Reference to the chat message';
COMMENT ON COLUMN client_portal_message_reads.user_id IS 'User who read the message';
COMMENT ON COLUMN client_portal_message_reads.read_at IS 'Timestamp when message was read';