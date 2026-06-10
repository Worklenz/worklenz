/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS project_links (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT,
      source_type TEXT NOT NULL DEFAULT 'manual',
      source_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
      source_comment_id UUID REFERENCES task_comments(id) ON DELETE CASCADE,
      added_by UUID REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT project_links_source_type_check CHECK (source_type IN ('manual', 'task_description', 'task_comment'))
    );
    CREATE INDEX IF NOT EXISTS idx_project_links_project_id ON project_links(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_links_source_task_id ON project_links(source_task_id);
    CREATE INDEX IF NOT EXISTS idx_project_links_source_comment_id ON project_links(source_comment_id);
    CREATE INDEX IF NOT EXISTS idx_project_links_created_at ON project_links(created_at DESC);
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS project_links;`);
};
