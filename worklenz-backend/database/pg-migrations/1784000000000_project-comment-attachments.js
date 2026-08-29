/**
 * Home > Inbox / project chat - message attachments.
 *
 * Adds project_comment_attachments (a comment has N attachments). Unlike
 * task_comment_attachments, these are uploaded before the comment row exists
 * (frontend uploads first, then sends the message), so the row can't derive
 * its storage location from comment_id the way task attachments do. Instead
 * it stores the object storage `key` (no domain/bucket baked in) computed at
 * upload time via getProjectCommentAttachmentKey(), and the public URL is
 * resolved from that key at read time (storage.ts#getPublicUrl) — so a
 * bucket/CDN/provider change doesn't strand existing rows with dead links.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS project_comment_attachments (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name        TEXT NOT NULL,
      type        TEXT,
      size        BIGINT,
      key         TEXT NOT NULL,
      comment_id  UUID NOT NULL REFERENCES project_comments(id) ON DELETE CASCADE,
      project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      uploaded_by UUID REFERENCES users(id),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_project_comment_attachments_comment
      ON project_comment_attachments (comment_id);
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS project_comment_attachments;
  `);
};
