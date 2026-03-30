'use strict';
// Converted from: database/migrations/20250130000001-create-slack-integration.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Create slack_workspaces table to store connected Slack workspaces
CREATE TABLE IF NOT EXISTS slack_workspaces (
    id                      UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    organization_id         UUID                                                NOT NULL,
    team_id                 TEXT                                                NOT NULL, -- Slack team/workspace ID
    team_name               TEXT                                                NOT NULL,
    access_token_encrypted  TEXT                                                NOT NULL, -- Encrypted with AES-256-GCM
    bot_user_id             TEXT,
    bot_access_token_encrypted TEXT,                                                     -- Encrypted with AES-256-GCM
    scope                   TEXT,
    authed_user_id          TEXT,
    is_active               BOOLEAN                  DEFAULT TRUE               NOT NULL,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    created_by              UUID,
    last_verified_at        TIMESTAMP WITH TIME ZONE
);

ALTER TABLE slack_workspaces
    ADD CONSTRAINT IF NOT EXISTS slack_workspaces_pk
        PRIMARY KEY (id);

ALTER TABLE slack_workspaces
    ADD CONSTRAINT IF NOT EXISTS slack_workspaces_organization_id_fk
        FOREIGN KEY (organization_id) REFERENCES organizations
            ON DELETE CASCADE;

ALTER TABLE slack_workspaces
    ADD CONSTRAINT IF NOT EXISTS slack_workspaces_created_by_fk
        FOREIGN KEY (created_by) REFERENCES users
            ON DELETE SET NULL;

ALTER TABLE slack_workspaces
    ADD CONSTRAINT IF NOT EXISTS slack_workspaces_organization_team_unique
        UNIQUE (organization_id, team_id);

-- Create slack_users table to store Slack user information
CREATE TABLE IF NOT EXISTS slack_users (
    id                UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    slack_workspace_id UUID                                                NOT NULL,
    user_id           UUID,                                                        -- Worklenz user ID (nullable for unmapped users)
    slack_user_id     TEXT                                                NOT NULL,
    slack_username    TEXT,
    slack_email       TEXT,
    slack_display_name TEXT,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE slack_users
    ADD CONSTRAINT IF NOT EXISTS slack_users_pk
        PRIMARY KEY (id);

ALTER TABLE slack_users
    ADD CONSTRAINT IF NOT EXISTS slack_users_slack_workspace_id_fk
        FOREIGN KEY (slack_workspace_id) REFERENCES slack_workspaces
            ON DELETE CASCADE;

ALTER TABLE slack_users
    ADD CONSTRAINT IF NOT EXISTS slack_users_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users
            ON DELETE SET NULL;

ALTER TABLE slack_users
    ADD CONSTRAINT IF NOT EXISTS slack_users_workspace_slack_user_unique
        UNIQUE (slack_workspace_id, slack_user_id);

-- Create slack_channels table to store Slack channel information
CREATE TABLE IF NOT EXISTS slack_channels (
    id                UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    slack_workspace_id UUID                                                NOT NULL,
    channel_id        TEXT                                                NOT NULL,
    channel_name      TEXT                                                NOT NULL,
    is_private        BOOLEAN                  DEFAULT FALSE              NOT NULL,
    is_archived       BOOLEAN                  DEFAULT FALSE              NOT NULL,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE slack_channels
    ADD CONSTRAINT IF NOT EXISTS slack_channels_pk
        PRIMARY KEY (id);

ALTER TABLE slack_channels
    ADD CONSTRAINT IF NOT EXISTS slack_channels_slack_workspace_id_fk
        FOREIGN KEY (slack_workspace_id) REFERENCES slack_workspaces
            ON DELETE CASCADE;

ALTER TABLE slack_channels
    ADD CONSTRAINT IF NOT EXISTS slack_channels_workspace_channel_unique
        UNIQUE (slack_workspace_id, channel_id);

-- Create slack_channel_configs table to link Worklenz projects with Slack channels
CREATE TABLE IF NOT EXISTS slack_channel_configs (
    id                UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    project_id        UUID                                                NOT NULL,
    slack_channel_id  UUID                                                NOT NULL,
    notification_types TEXT[],                                                     -- Array of notification types to send
    is_active         BOOLEAN                  DEFAULT TRUE               NOT NULL,
    created_by        UUID,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE slack_channel_configs
    ADD CONSTRAINT IF NOT EXISTS slack_channel_configs_pk
        PRIMARY KEY (id);

ALTER TABLE slack_channel_configs
    ADD CONSTRAINT IF NOT EXISTS slack_channel_configs_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE slack_channel_configs
    ADD CONSTRAINT IF NOT EXISTS slack_channel_configs_slack_channel_id_fk
        FOREIGN KEY (slack_channel_id) REFERENCES slack_channels
            ON DELETE CASCADE;

ALTER TABLE slack_channel_configs
    ADD CONSTRAINT IF NOT EXISTS slack_channel_configs_created_by_fk
        FOREIGN KEY (created_by) REFERENCES users
            ON DELETE SET NULL;

ALTER TABLE slack_channel_configs
    ADD CONSTRAINT IF NOT EXISTS slack_channel_configs_project_channel_unique
        UNIQUE (project_id, slack_channel_id);

-- Create slack_notifications table to track sent notifications
CREATE TABLE IF NOT EXISTS slack_notifications (
    id                   UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    slack_channel_config_id UUID                                                NOT NULL,
    notification_type    TEXT                                                NOT NULL,
    slack_message_ts     TEXT,                                                         -- Slack message timestamp
    worklenz_entity_type TEXT,                                                         -- e.g., 'task', 'project', 'comment'
    worklenz_entity_id   UUID,
    message_payload      JSONB,
    status              TEXT                     DEFAULT 'pending'          NOT NULL, -- pending, sent, failed
    error_message       TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    sent_at             TIMESTAMP WITH TIME ZONE
);

ALTER TABLE slack_notifications
    ADD CONSTRAINT IF NOT EXISTS slack_notifications_pk
        PRIMARY KEY (id);

ALTER TABLE slack_notifications
    ADD CONSTRAINT IF NOT EXISTS slack_notifications_config_id_fk
        FOREIGN KEY (slack_channel_config_id) REFERENCES slack_channel_configs
            ON DELETE CASCADE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_slack_workspaces_organization_id ON slack_workspaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_slack_workspaces_team_id ON slack_workspaces(team_id);
CREATE INDEX IF NOT EXISTS idx_slack_users_user_id ON slack_users(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_users_slack_user_id ON slack_users(slack_user_id);
CREATE INDEX IF NOT EXISTS idx_slack_channels_workspace_id ON slack_channels(slack_workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_channel_configs_project_id ON slack_channel_configs(project_id);
CREATE INDEX IF NOT EXISTS idx_slack_notifications_config_id ON slack_notifications(slack_channel_config_id);
CREATE INDEX IF NOT EXISTS idx_slack_notifications_status ON slack_notifications(status);
CREATE INDEX IF NOT EXISTS idx_slack_notifications_entity ON slack_notifications(worklenz_entity_type, worklenz_entity_id);

-- Create slack_audit_log table for security and compliance
CREATE TABLE IF NOT EXISTS slack_audit_log (
    id              UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    action          TEXT                                                NOT NULL,
    user_id         UUID,
    organization_id UUID,
    details         JSONB,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE slack_audit_log
    ADD CONSTRAINT IF NOT EXISTS slack_audit_log_pk
        PRIMARY KEY (id);

ALTER TABLE slack_audit_log
    ADD CONSTRAINT IF NOT EXISTS slack_audit_log_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users
            ON DELETE SET NULL;

ALTER TABLE slack_audit_log
    ADD CONSTRAINT IF NOT EXISTS slack_audit_log_organization_id_fk
        FOREIGN KEY (organization_id) REFERENCES organizations
            ON DELETE CASCADE;

-- Create indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_slack_audit_log_user_id ON slack_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_audit_log_organization_id ON slack_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_slack_audit_log_action ON slack_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_slack_audit_log_created_at ON slack_audit_log(created_at DESC);

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
