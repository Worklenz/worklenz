/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS project_documents (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      parent_id UUID REFERENCES project_documents(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      content JSONB NOT NULL DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb,
      content_text TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      created_by UUID REFERENCES users(id) ON DELETE SET NULL,
      updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP WITH TIME ZONE,
      CONSTRAINT project_documents_title_length CHECK (char_length(title) BETWEEN 1 AND 500)
    );

    CREATE INDEX IF NOT EXISTS idx_project_documents_tree
      ON project_documents (project_id, parent_id, position)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_project_documents_project
      ON project_documents (project_id)
      WHERE deleted_at IS NULL;

    CREATE TABLE IF NOT EXISTS project_document_mentions (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      document_id UUID NOT NULL REFERENCES project_documents(id) ON DELETE CASCADE,
      mention_type TEXT NOT NULL,
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT project_document_mentions_type_check CHECK (
        (
          mention_type = 'member'
          AND user_id IS NOT NULL
          AND task_id IS NULL
        ) OR (
          mention_type = 'task'
          AND task_id IS NOT NULL
          AND user_id IS NULL
        )
      )
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_project_document_mentions_member
      ON project_document_mentions (document_id, user_id)
      WHERE user_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_project_document_mentions_task
      ON project_document_mentions (document_id, task_id)
      WHERE task_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_project_document_mentions_task_lookup
      ON project_document_mentions (task_id)
      WHERE task_id IS NOT NULL;
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS project_document_mentions;
    DROP TABLE IF EXISTS project_documents;
  `);
};
