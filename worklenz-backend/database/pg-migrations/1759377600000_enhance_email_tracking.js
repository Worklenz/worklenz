'use strict';
// Converted from: database/migrations/20250929000000-enhance-email-tracking.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Add columns to email_logs table for better tracking
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS message_id TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS error_details TEXT;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Create email status enum type
DO $$ BEGIN
    CREATE TYPE email_status_type AS ENUM ('pending', 'sent', 'delivered', 'bounced', 'failed', 'complaint');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update status column to use enum
ALTER TABLE email_logs ALTER COLUMN status TYPE email_status_type USING status::email_status_type;
ALTER TABLE email_logs ALTER COLUMN status SET DEFAULT 'pending'::email_status_type;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_email_logs_status ON email_logs(status);
CREATE INDEX IF NOT EXISTS idx_email_logs_message_id ON email_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_email_status ON email_logs(email, status);
CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at);

-- Add unique constraint on message_id where not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_logs_message_id_unique ON email_logs(message_id) WHERE message_id IS NOT NULL;

-- CREATE TABLE IF NOT EXISTS for email delivery events from SES webhooks
CREATE TABLE IF NOT EXISTS email_delivery_events (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    message_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'send', 'delivery', 'bounce', 'complaint', 'reject'
    recipient_email TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- Add indexes for email delivery events
CREATE INDEX IF NOT EXISTS idx_email_delivery_events_message_id ON email_delivery_events(message_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_events_email ON email_delivery_events(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_delivery_events_type ON email_delivery_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_delivery_events_timestamp ON email_delivery_events(timestamp);

-- Add trigger to update email_logs status based on delivery events
CREATE OR REPLACE FUNCTION update_email_log_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update email_logs status based on delivery event
    UPDATE email_logs
    SET status = CASE
        WHEN NEW.event_type = 'send' THEN 'sent'::email_status_type
        WHEN NEW.event_type = 'delivery' THEN 'delivered'::email_status_type
        WHEN NEW.event_type = 'bounce' THEN 'bounced'::email_status_type
        WHEN NEW.event_type = 'complaint' THEN 'complaint'::email_status_type
        WHEN NEW.event_type = 'reject' THEN 'failed'::email_status_type
        ELSE status
    END,
    delivered_at = CASE
        WHEN NEW.event_type = 'delivery' THEN NEW.timestamp
        ELSE delivered_at
    END,
    updated_at = CURRENT_TIMESTAMP
    WHERE message_id = NEW.message_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_email_log_status ON email_delivery_events;
CREATE TRIGGER trigger_update_email_log_status
    AFTER INSERT ON email_delivery_events
    FOR EACH ROW
    EXECUTE FUNCTION update_email_log_status();
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
