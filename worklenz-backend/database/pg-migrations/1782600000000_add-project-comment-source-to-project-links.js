/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    -- Allow links auto-detected from project comments
    ALTER TABLE project_links
      DROP CONSTRAINT IF EXISTS project_links_source_type_check;
    ALTER TABLE project_links
      ADD CONSTRAINT project_links_source_type_check
      CHECK (source_type IN ('manual', 'task_description', 'task_comment', 'project_comment'));

    -- Project comments live in a different table than task comments, so they need
    -- their own FK column (source_comment_id references task_comments).
    ALTER TABLE project_links
      ADD COLUMN IF NOT EXISTS source_project_comment_id UUID
      REFERENCES project_comments(id) ON DELETE CASCADE;

    CREATE INDEX IF NOT EXISTS idx_project_links_source_project_comment_id
      ON project_links(source_project_comment_id);
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_project_links_source_project_comment_id;
    ALTER TABLE project_links DROP COLUMN IF EXISTS source_project_comment_id;
    ALTER TABLE project_links DROP CONSTRAINT IF EXISTS project_links_source_type_check;
    ALTER TABLE project_links
      ADD CONSTRAINT project_links_source_type_check
      CHECK (source_type IN ('manual', 'task_description', 'task_comment'));
  `);
};
