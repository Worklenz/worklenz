'use strict';

/**
 * Phase 1 — Custom project template config preservation schema.
 *
 * Adds schema versioning, includes/settings snapshots, extended cpt_tasks fields,
 * and related tables for assignees, dependencies, recurrence, and rate cards.
 *
 * Existing templates remain schema_version = 1 (default). No backfill.
 *
 * @see docs/project-templates-config-preservation-phase0.md
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    -- -------------------------------------------------------------------------
    -- 1. Versioned template payload on custom_project_templates
    -- -------------------------------------------------------------------------
    ALTER TABLE custom_project_templates
      ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1,
      ADD COLUMN IF NOT EXISTS includes JSONB NOT NULL DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS settings JSONB;

    ALTER TABLE custom_project_templates
      DROP CONSTRAINT IF EXISTS custom_project_templates_schema_version_check;

    ALTER TABLE custom_project_templates
      ADD CONSTRAINT custom_project_templates_schema_version_check
        CHECK (schema_version >= 1);

    COMMENT ON COLUMN custom_project_templates.schema_version IS
      'Template payload version. 1 = legacy (pre config-preservation). 2 = project settings + extended task config.';
    COMMENT ON COLUMN custom_project_templates.includes IS
      'JSON flags for which project/projectSettings/task elements were saved.';
    COMMENT ON COLUMN custom_project_templates.settings IS
      'Snapshot of project settings when corresponding includes toggles are on (category, PM, estimates, advanced, budget).';

    CREATE INDEX IF NOT EXISTS idx_custom_project_templates_schema_version
      ON custom_project_templates (schema_version);

    -- -------------------------------------------------------------------------
    -- 2. Extended task fields on cpt_tasks
    -- -------------------------------------------------------------------------
    ALTER TABLE cpt_tasks
      ADD COLUMN IF NOT EXISTS billable BOOLEAN DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS start_offset_days INTEGER,
      ADD COLUMN IF NOT EXISTS due_offset_days INTEGER,
      ADD COLUMN IF NOT EXISTS schedule_id UUID,
      ADD COLUMN IF NOT EXISTS task_duration_days INTEGER;

    COMMENT ON COLUMN cpt_tasks.start_offset_days IS
      'Calendar-day offset from project start date for task start_date. NULL = undated.';
    COMMENT ON COLUMN cpt_tasks.due_offset_days IS
      'Calendar-day offset from project start date for task end_date/due. NULL = undated.';
    COMMENT ON COLUMN cpt_tasks.schedule_id IS
      'Optional FK to cpt_task_recurring_schedules when recurrence was included.';
    COMMENT ON COLUMN cpt_tasks.task_duration_days IS
      'Original task duration in days (for recurring occurrence start/end calculation).';

    -- -------------------------------------------------------------------------
    -- 3. Template task assignees
    -- -------------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS cpt_task_assignees (
      id             UUID                     DEFAULT uuid_generate_v4() NOT NULL,
      task_id        UUID                                                NOT NULL,
      team_member_id UUID                                                NOT NULL,
      email          TEXT,
      name           TEXT,
      created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
      CONSTRAINT cpt_task_assignees_pk PRIMARY KEY (id),
      CONSTRAINT cpt_task_assignees_task_id_fk
        FOREIGN KEY (task_id) REFERENCES cpt_tasks (id) ON DELETE CASCADE,
      CONSTRAINT cpt_task_assignees_unique
        UNIQUE (task_id, team_member_id)
    );

    COMMENT ON TABLE cpt_task_assignees IS
      'Assignees stored with a custom project template task. email/name aid future org-share resolution.';
    COMMENT ON COLUMN cpt_task_assignees.team_member_id IS
      'Source team_member id at save time. May be inactive or absent at apply; resolve then.';

    CREATE INDEX IF NOT EXISTS idx_cpt_task_assignees_task_id
      ON cpt_task_assignees (task_id);
    CREATE INDEX IF NOT EXISTS idx_cpt_task_assignees_team_member_id
      ON cpt_task_assignees (team_member_id);

    -- -------------------------------------------------------------------------
    -- 4. Template task dependencies (remap to new task ids on apply)
    -- -------------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS cpt_task_dependencies (
      id              UUID                     DEFAULT uuid_generate_v4() NOT NULL,
      task_id         UUID                                                NOT NULL,
      related_task_id UUID                                                NOT NULL,
      dependency_type DEPENDENCY_TYPE          DEFAULT 'blocked_by'::DEPENDENCY_TYPE NOT NULL,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
      CONSTRAINT cpt_task_dependencies_pk PRIMARY KEY (id),
      CONSTRAINT cpt_task_dependencies_task_id_fk
        FOREIGN KEY (task_id) REFERENCES cpt_tasks (id) ON DELETE CASCADE,
      CONSTRAINT cpt_task_dependencies_related_task_id_fk
        FOREIGN KEY (related_task_id) REFERENCES cpt_tasks (id) ON DELETE CASCADE,
      CONSTRAINT cpt_task_dependencies_unique
        UNIQUE (task_id, related_task_id, dependency_type),
      CONSTRAINT cpt_task_dependencies_no_self
        CHECK (task_id <> related_task_id)
    );

    COMMENT ON TABLE cpt_task_dependencies IS
      'Dependencies between tasks inside a custom project template. External links are not stored.';

    CREATE INDEX IF NOT EXISTS idx_cpt_task_dependencies_task_id
      ON cpt_task_dependencies (task_id);
    CREATE INDEX IF NOT EXISTS idx_cpt_task_dependencies_related_task_id
      ON cpt_task_dependencies (related_task_id);

    -- -------------------------------------------------------------------------
    -- 5. Template recurrence schedules (rule only; no occurrence history)
    -- -------------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS cpt_task_recurring_schedules (
      id                  UUID                     DEFAULT uuid_generate_v4() NOT NULL,
      template_id         UUID                                                NOT NULL,
      schedule_type       SCHEDULE_TYPE            DEFAULT 'daily'::SCHEDULE_TYPE NOT NULL,
      days_of_week        INTEGER[],
      day_of_month        INTEGER,
      date_of_month       INTEGER,
      week_of_month       INTEGER,
      interval_days       INTEGER,
      interval_weeks      INTEGER,
      interval_months     INTEGER,
      end_offset_days     INTEGER,
      max_occurrences     INTEGER,
      recurring_mode      TEXT                     DEFAULT 'create_task' NOT NULL,
      target_status_name  TEXT,
      timezone_name       TEXT                     DEFAULT 'UTC',
      created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      CONSTRAINT cpt_task_recurring_schedules_pk PRIMARY KEY (id),
      CONSTRAINT cpt_task_recurring_schedules_template_id_fk
        FOREIGN KEY (template_id) REFERENCES custom_project_templates (id) ON DELETE CASCADE,
      CONSTRAINT cpt_task_recurring_schedules_mode_check
        CHECK (recurring_mode IN ('create_task', 'change_status'))
    );

    COMMENT ON TABLE cpt_task_recurring_schedules IS
      'Recurrence rules for template tasks. Absolute past dates and occurrence history are never stored.';
    COMMENT ON COLUMN cpt_task_recurring_schedules.end_offset_days IS
      'Optional calendar-day offset from new project start when the schedule should end. NULL = no end date.';
    COMMENT ON COLUMN cpt_task_recurring_schedules.target_status_name IS
      'Status name for change_status mode (resolved to project status on apply).';

    CREATE INDEX IF NOT EXISTS idx_cpt_task_recurring_schedules_template_id
      ON cpt_task_recurring_schedules (template_id);

    -- Add FK from cpt_tasks.schedule_id now that the schedules table exists
    ALTER TABLE cpt_tasks
      DROP CONSTRAINT IF EXISTS cpt_tasks_schedule_id_fk;

    ALTER TABLE cpt_tasks
      ADD CONSTRAINT cpt_tasks_schedule_id_fk
        FOREIGN KEY (schedule_id) REFERENCES cpt_task_recurring_schedules (id)
          ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_cpt_tasks_schedule_id
      ON cpt_tasks (schedule_id)
      WHERE schedule_id IS NOT NULL;

    -- -------------------------------------------------------------------------
    -- 6. Template project rate card (Budget settings toggle)
    -- -------------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS cpt_rate_card_roles (
      id              UUID                     DEFAULT uuid_generate_v4() NOT NULL,
      template_id     UUID                                                NOT NULL,
      job_title_id    UUID,
      job_title_name  TEXT                                                NOT NULL,
      rate            NUMERIC                  DEFAULT 0                  NOT NULL,
      man_day_rate    NUMERIC,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
      CONSTRAINT cpt_rate_card_roles_pk PRIMARY KEY (id),
      CONSTRAINT cpt_rate_card_roles_template_id_fk
        FOREIGN KEY (template_id) REFERENCES custom_project_templates (id) ON DELETE CASCADE,
      CONSTRAINT cpt_rate_card_roles_rate_check
        CHECK (rate >= 0),
      CONSTRAINT cpt_rate_card_roles_man_day_rate_check
        CHECK (man_day_rate IS NULL OR man_day_rate >= 0)
    );

    COMMENT ON TABLE cpt_rate_card_roles IS
      'Project rate card snapshot for a template. Rows with missing job titles are skipped at apply.';
    COMMENT ON COLUMN cpt_rate_card_roles.job_title_id IS
      'Job title id at save time; may be null/missing at apply — resolve by name then.';

    CREATE INDEX IF NOT EXISTS idx_cpt_rate_card_roles_template_id
      ON cpt_rate_card_roles (template_id);
    CREATE INDEX IF NOT EXISTS idx_cpt_rate_card_roles_job_title_id
      ON cpt_rate_card_roles (job_title_id)
      WHERE job_title_id IS NOT NULL;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE cpt_tasks
      DROP CONSTRAINT IF EXISTS cpt_tasks_schedule_id_fk;

    DROP INDEX IF EXISTS idx_cpt_rate_card_roles_job_title_id;
    DROP INDEX IF EXISTS idx_cpt_rate_card_roles_template_id;
    DROP TABLE IF EXISTS cpt_rate_card_roles;

    DROP INDEX IF EXISTS idx_cpt_tasks_schedule_id;
    DROP INDEX IF EXISTS idx_cpt_task_recurring_schedules_template_id;
    DROP TABLE IF EXISTS cpt_task_recurring_schedules;

    DROP INDEX IF EXISTS idx_cpt_task_dependencies_related_task_id;
    DROP INDEX IF EXISTS idx_cpt_task_dependencies_task_id;
    DROP TABLE IF EXISTS cpt_task_dependencies;

    DROP INDEX IF EXISTS idx_cpt_task_assignees_team_member_id;
    DROP INDEX IF EXISTS idx_cpt_task_assignees_task_id;
    DROP TABLE IF EXISTS cpt_task_assignees;

    ALTER TABLE cpt_tasks
      DROP COLUMN IF EXISTS task_duration_days,
      DROP COLUMN IF EXISTS schedule_id,
      DROP COLUMN IF EXISTS due_offset_days,
      DROP COLUMN IF EXISTS start_offset_days,
      DROP COLUMN IF EXISTS billable;

    DROP INDEX IF EXISTS idx_custom_project_templates_schema_version;

    ALTER TABLE custom_project_templates
      DROP CONSTRAINT IF EXISTS custom_project_templates_schema_version_check;

    ALTER TABLE custom_project_templates
      DROP COLUMN IF EXISTS settings,
      DROP COLUMN IF EXISTS includes,
      DROP COLUMN IF EXISTS schema_version;
  `);
};
