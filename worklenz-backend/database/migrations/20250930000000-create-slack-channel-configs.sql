-- Create Slack channel configuration table used by API /api/slack/channel-configs
-- Includes mapping of team -> project -> slack channel with notification types

CREATE TABLE IF NOT EXISTS slack_channel_configs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID NOT NULL,
    project_id UUID NOT NULL,
    channel_id VARCHAR(255) NOT NULL,
    channel_name VARCHAR(255) DEFAULT 'Unknown' NOT NULL,
    notification_types TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT slack_channel_configs_team_fk FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT slack_channel_configs_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_slack_channel_configs_team ON slack_channel_configs(team_id);
CREATE INDEX IF NOT EXISTS idx_slack_channel_configs_project ON slack_channel_configs(project_id);
CREATE INDEX IF NOT EXISTS idx_slack_channel_configs_active ON slack_channel_configs(is_active);

COMMENT ON TABLE slack_channel_configs IS 'Per-team Slack channel configuration for notifications';
COMMENT ON COLUMN slack_channel_configs.notification_types IS 'Array of notification type keys (e.g., task_created)';


