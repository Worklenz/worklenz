'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS discord_webhook_configs (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
      guild_id TEXT,
      webhook_url_encrypted TEXT NOT NULL,
      notification_types TEXT[] NOT NULL DEFAULT ARRAY['task_assigned', 'status_changed', 'task_completed', 'comment_added'],
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS discord_webhook_configs_scope_unique
      ON discord_webhook_configs (organization_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::UUID));

    CREATE TABLE IF NOT EXISTS discord_user_mappings (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      discord_user_id TEXT NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (organization_id, discord_user_id)
    );

    CREATE INDEX IF NOT EXISTS discord_webhook_configs_project_idx
      ON discord_webhook_configs (project_id);
    CREATE INDEX IF NOT EXISTS discord_user_mappings_lookup_idx
      ON discord_user_mappings (organization_id, discord_user_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS discord_user_mappings;
    DROP TABLE IF EXISTS discord_webhook_configs;
  `);
};
