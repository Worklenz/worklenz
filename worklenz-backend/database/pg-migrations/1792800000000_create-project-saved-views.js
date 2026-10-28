'use strict';
// Project saved views (#1345): a filtered/sorted/grouped Task List that is saved as its own
// project tab ("Save as a new tab"). Views are shared with everyone who can open the project.
// The API validates the config document before it is written
// (src/shared/project-saved-views.ts); the CHECK below is only a last line of defence.

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS project_saved_views (
      id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
      project_id  UUID                                                NOT NULL,
      -- Keep the view when its creator is deleted; must stay nullable for ON DELETE SET NULL.
      created_by  UUID,
      name        TEXT                                                NOT NULL
                       CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
      base_view   TEXT                     DEFAULT 'tasks-list'       NOT NULL
                       CHECK (base_view IN ('tasks-list')),
      -- { version, priorities[], statuses[], phases[], members[], labels[], search,
      --   archived, group, sort_field, sort_order }
      config      JSONB                    DEFAULT '{}'::jsonb        NOT NULL
                       CHECK (jsonb_typeof(config) = 'object'),
      sort_order  INTEGER                  DEFAULT 0                  NOT NULL,
      created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
      updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
    );

    ALTER TABLE project_saved_views
      ADD CONSTRAINT project_saved_views_pk PRIMARY KEY (id);

    ALTER TABLE project_saved_views
      ADD CONSTRAINT project_saved_views_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
          ON DELETE CASCADE;

    ALTER TABLE project_saved_views
      ADD CONSTRAINT project_saved_views_created_by_fk
        FOREIGN KEY (created_by) REFERENCES users
          ON DELETE SET NULL;

    -- Tab bar listing for a project, in tab order.
    CREATE INDEX IF NOT EXISTS idx_project_saved_views_project_order
      ON project_saved_views (project_id, sort_order, created_at);
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_project_saved_views_project_order;
    DROP TABLE IF EXISTS project_saved_views;
  `);
};
