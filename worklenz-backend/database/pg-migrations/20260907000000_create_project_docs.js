"use strict";

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS project_docs (
      id UUID DEFAULT uuid_generate_v4() NOT NULL,
      project_id UUID NOT NULL,
      team_id UUID NOT NULL,
      parent_id UUID,
      title TEXT NOT NULL,
      content TEXT DEFAULT '' NOT NULL,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
      CONSTRAINT project_docs_pk PRIMARY KEY (id),
      CONSTRAINT project_docs_project_fk FOREIGN KEY (project_id) REFERENCES projects ON DELETE CASCADE,
      CONSTRAINT project_docs_team_fk FOREIGN KEY (team_id) REFERENCES teams ON DELETE CASCADE,
      CONSTRAINT project_docs_parent_fk FOREIGN KEY (parent_id) REFERENCES project_docs ON DELETE CASCADE,
      CONSTRAINT project_docs_created_by_fk FOREIGN KEY (created_by) REFERENCES users ON DELETE SET NULL,
      CONSTRAINT project_docs_updated_by_fk FOREIGN KEY (updated_by) REFERENCES users ON DELETE SET NULL,
      CONSTRAINT project_docs_title_check CHECK (CHAR_LENGTH(title) BETWEEN 1 AND 255)
    );
    CREATE TABLE IF NOT EXISTS project_doc_tasks (
      doc_id UUID NOT NULL,
      task_id UUID NOT NULL,
      CONSTRAINT project_doc_tasks_pk PRIMARY KEY (doc_id, task_id),
      CONSTRAINT project_doc_tasks_doc_fk FOREIGN KEY (doc_id) REFERENCES project_docs ON DELETE CASCADE,
      CONSTRAINT project_doc_tasks_task_fk FOREIGN KEY (task_id) REFERENCES tasks ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_project_docs_project_id ON project_docs(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_docs_parent_id ON project_docs(parent_id);
    CREATE INDEX IF NOT EXISTS idx_project_doc_tasks_task_id ON project_doc_tasks(task_id);

    CREATE OR REPLACE FUNCTION prevent_project_doc_cycle()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.parent_id IS NULL THEN
        RETURN NEW;
      END IF;
      IF NEW.parent_id = NEW.id THEN
        RAISE EXCEPTION 'project document cannot be its own parent' USING ERRCODE = '23514';
      END IF;
      IF EXISTS (
        WITH RECURSIVE ancestors AS (
          SELECT id, parent_id FROM project_docs WHERE id = NEW.parent_id
          UNION ALL
          SELECT d.id, d.parent_id
          FROM project_docs d
          JOIN ancestors a ON d.id = a.parent_id
        )
        SELECT 1 FROM ancestors WHERE id = NEW.id
      ) THEN
        RAISE EXCEPTION 'project document parent would create a cycle' USING ERRCODE = '23514';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS project_docs_prevent_cycle ON project_docs;
    CREATE CONSTRAINT TRIGGER project_docs_prevent_cycle
      AFTER INSERT OR UPDATE OF parent_id ON project_docs
      DEFERRABLE INITIALLY IMMEDIATE
      FOR EACH ROW EXECUTE FUNCTION prevent_project_doc_cycle();
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS project_docs_prevent_cycle ON project_docs;
    DROP FUNCTION IF EXISTS prevent_project_doc_cycle();
    DROP TABLE IF EXISTS project_doc_tasks;
    DROP TABLE IF EXISTS project_docs;
  `);
};
