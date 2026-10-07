'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Baseline gap: task_comments.is_edited and cpt_task_phase exist in released databases
 * but are not created by database/sql/*.sql or any earlier public migration.
 * Idempotent: a no-op where the objects already exist (deployed databases).
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = async (pgm) => {
  pgm.sql(`
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS is_edited boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS cpt_task_phase (
    task_id uuid NOT NULL,
    phase_id uuid NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS cpt_task_phase_cpt_task_phase_uindex ON cpt_task_phase USING btree (task_id, phase_id);
CREATE UNIQUE INDEX IF NOT EXISTS cpt_task_phase_task_id_uindex ON cpt_task_phase USING btree (task_id);
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cpt_task_phase_phase_id_fk') THEN
        ALTER TABLE cpt_task_phase ADD CONSTRAINT cpt_task_phase_phase_id_fk
            FOREIGN KEY (phase_id) REFERENCES cpt_phases(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cpt_task_phase_task_id_fk') THEN
        ALTER TABLE cpt_task_phase ADD CONSTRAINT cpt_task_phase_task_id_fk
            FOREIGN KEY (task_id) REFERENCES cpt_tasks(id) ON DELETE CASCADE;
    END IF;
END $$;
  `);
};

exports.down = async (_pgm) => {};
