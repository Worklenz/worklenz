/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE TABLE IF NOT EXISTS project_document_favorites (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_id UUID NOT NULL REFERENCES project_documents(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, document_id)
    );
    CREATE INDEX IF NOT EXISTS idx_project_document_favorites_document ON project_document_favorites (document_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS project_document_favorites;');
};
