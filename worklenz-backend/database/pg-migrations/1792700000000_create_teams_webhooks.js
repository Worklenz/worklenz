'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Per-project Microsoft Teams incoming webhooks (Workflows / Power Automate URLs)
CREATE TABLE IF NOT EXISTS teams_webhooks (
    id                    UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    project_id            UUID                                                NOT NULL,
    name                  TEXT                                                NOT NULL,
    webhook_url_encrypted TEXT                                                NOT NULL,
    notification_types    TEXT[]                   DEFAULT '{}'               NOT NULL,
    is_active             BOOLEAN                  DEFAULT TRUE               NOT NULL,
    last_sent_at          TIMESTAMP WITH TIME ZONE,
    last_error            TEXT,
    created_by            UUID,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    CONSTRAINT teams_webhooks_pk PRIMARY KEY (id),
    CONSTRAINT teams_webhooks_project_id_fk FOREIGN KEY (project_id) REFERENCES projects ON DELETE CASCADE,
    CONSTRAINT teams_webhooks_created_by_fk FOREIGN KEY (created_by) REFERENCES users ON DELETE SET NULL,
    CONSTRAINT teams_webhooks_name_length CHECK (char_length(name) BETWEEN 1 AND 100)
);

CREATE INDEX IF NOT EXISTS teams_webhooks_project_id_index ON teams_webhooks (project_id) WHERE is_active;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS teams_webhooks;`);
};
