"use strict";

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Stub tables for Reporting & Analytics Phase 1.
 * Controllers / jobs in later phases fill these out.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = async (pgm) => {
  pgm.sql(`
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Workspace-level SLA policies (OQ-3 / OQ-7)
CREATE TABLE IF NOT EXISTS sla_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
  response_minutes INTEGER,
  resolution_minutes INTEGER,
  project_ids UUID[] DEFAULT '{}',
  label_ids UUID[] DEFAULT '{}',
  priority_ids UUID[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sla_policies_team_id ON sla_policies(team_id);

CREATE TABLE IF NOT EXISTS issue_sla_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES sla_policies(id) ON DELETE CASCADE,
  response_due_at TIMESTAMPTZ,
  resolution_due_at TIMESTAMPTZ,
  first_responded_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  status VARCHAR(32) NOT NULL DEFAULT 'on_track',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (task_id, policy_id)
);

CREATE INDEX IF NOT EXISTS idx_issue_sla_records_policy ON issue_sla_records(policy_id);
CREATE INDEX IF NOT EXISTS idx_issue_sla_records_status ON issue_sla_records(status);

-- Custom dashboards
CREATE TABLE IF NOT EXISTS analytics_dashboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  visibility VARCHAR(32) NOT NULL DEFAULT 'private',
  layout_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  refresh_interval_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_team ON analytics_dashboards(team_id);
CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_owner ON analytics_dashboards(owner_id);

CREATE TABLE IF NOT EXISTS analytics_dashboard_gadgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dashboard_id UUID NOT NULL REFERENCES analytics_dashboards(id) ON DELETE CASCADE,
  gadget_type VARCHAR(64) NOT NULL,
  title VARCHAR(120),
  position_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_dashboard_gadgets_dashboard
  ON analytics_dashboard_gadgets(dashboard_id);

-- Daily CFD snapshots (OQ-4)
CREATE TABLE IF NOT EXISTS cfd_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  status_id UUID NOT NULL REFERENCES task_statuses(id) ON DELETE CASCADE,
  issue_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (project_id, snapshot_date, status_id)
);

CREATE INDEX IF NOT EXISTS idx_cfd_daily_snapshots_project_date
  ON cfd_daily_snapshots(project_id, snapshot_date);

-- Saved report templates (velocity etc.)
CREATE TABLE IF NOT EXISTS analytics_report_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_kind VARCHAR(64) NOT NULL,
  name VARCHAR(60) NOT NULL,
  is_workspace_shared BOOLEAN NOT NULL DEFAULT FALSE,
  filters_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_report_templates_team
  ON analytics_report_templates(team_id);
CREATE INDEX IF NOT EXISTS idx_analytics_report_templates_owner
  ON analytics_report_templates(owner_id);
`);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
DROP TABLE IF EXISTS analytics_report_templates;
DROP TABLE IF EXISTS cfd_daily_snapshots;
DROP TABLE IF EXISTS analytics_dashboard_gadgets;
DROP TABLE IF EXISTS analytics_dashboards;
DROP TABLE IF EXISTS issue_sla_records;
DROP TABLE IF EXISTS sla_policies;
`);
};
