-- Slack Integration Tables and Indexes
-- Migration: 20250130000000-create-slack-tables-and-indexes.sql

-- Create Slack workspaces table
CREATE TABLE IF NOT EXISTS slack_workspaces (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    team_id UUID NOT NULL,
    slack_team_id VARCHAR(255) NOT NULL,
    slack_team_name VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    bot_user_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT slack_workspaces_pk PRIMARY KEY (id),
    CONSTRAINT slack_workspaces_team_id_fk FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT slack_workspaces_slack_team_id_unique UNIQUE (slack_team_id)
);

-- Create Slack users table
CREATE TABLE IF NOT EXISTS slack_users (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    slack_workspace_id UUID NOT NULL,
    user_id UUID NOT NULL,
    slack_user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT slack_users_pk PRIMARY KEY (id),
    CONSTRAINT slack_users_workspace_fk FOREIGN KEY (slack_workspace_id) REFERENCES slack_workspaces(id) ON DELETE CASCADE,
    CONSTRAINT slack_users_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT slack_users_slack_user_id_unique UNIQUE (slack_user_id, slack_workspace_id)
);

-- Create Slack channels table
CREATE TABLE IF NOT EXISTS slack_channels (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    slack_workspace_id UUID NOT NULL,
    project_id UUID NOT NULL,
    slack_channel_id VARCHAR(255) NOT NULL,
    slack_channel_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT slack_channels_pk PRIMARY KEY (id),
    CONSTRAINT slack_channels_workspace_fk FOREIGN KEY (slack_workspace_id) REFERENCES slack_workspaces(id) ON DELETE CASCADE,
    CONSTRAINT slack_channels_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT slack_channels_slack_channel_id_unique UNIQUE (slack_channel_id, slack_workspace_id)
);

-- Create Slack notifications table
CREATE TABLE IF NOT EXISTS slack_notifications (
    id UUID DEFAULT uuid_generate_v4() NOT NULL,
    slack_workspace_id UUID NOT NULL,
    channel_id UUID NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT slack_notifications_pk PRIMARY KEY (id),
    CONSTRAINT slack_notifications_workspace_fk FOREIGN KEY (slack_workspace_id) REFERENCES slack_workspaces(id) ON DELETE CASCADE,
    CONSTRAINT slack_notifications_channel_fk FOREIGN KEY (channel_id) REFERENCES slack_channels(id) ON DELETE CASCADE
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_slack_workspaces_team_id ON slack_workspaces(team_id);
CREATE INDEX IF NOT EXISTS idx_slack_users_user_id ON slack_users(user_id);
CREATE INDEX IF NOT EXISTS idx_slack_channels_project_id ON slack_channels(project_id);
CREATE INDEX IF NOT EXISTS idx_slack_notifications_status ON slack_notifications(status);

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_slack_workspaces_slack_team_id ON slack_workspaces(slack_team_id);
CREATE INDEX IF NOT EXISTS idx_slack_users_slack_workspace_id ON slack_users(slack_workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_channels_slack_workspace_id ON slack_channels(slack_workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_channels_is_active ON slack_channels(is_active);
CREATE INDEX IF NOT EXISTS idx_slack_notifications_slack_workspace_id ON slack_notifications(slack_workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_notifications_created_at ON slack_notifications(created_at);

-- Add comments for documentation
COMMENT ON TABLE slack_workspaces IS 'Stores Slack workspace connections for teams';
COMMENT ON TABLE slack_users IS 'Maps Worklenz users to Slack users within workspaces';
COMMENT ON TABLE slack_channels IS 'Maps Worklenz projects to Slack channels';
COMMENT ON TABLE slack_notifications IS 'Tracks Slack notification delivery status';

