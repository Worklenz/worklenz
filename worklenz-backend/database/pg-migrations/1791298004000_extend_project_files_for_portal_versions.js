'use strict';
// Client Portal v2 (#2506 Files & Documents).
//
// Extends project_files (the main-app Files tab keeps working unchanged) with the portal's
// per-file settings, and adds versioning.
//
//   - category (8 values; existing files become 'Other', new uploads default to 'Deliverable')
//   - portal_visibility: Internal Only by default
//   - uploaded_by_side / uploaded_by_contact_id / uploaded_by_name: client uploads are tagged
//     "Client upload" and always visible to the project team, whatever the visibility switch says
//   - current_version
//
// NOTE: this environment's project_files may already carry unrelated "source" / "external_url"
// columns from another branch, so the origin column is deliberately named uploaded_by_side.
//
// Versioning model. Version 1 IS the project_files row (its storage object is derived from the
// file id, as it always was), so nothing is backfilled and existing files and the main Files tab
// are untouched. project_file_versions holds only REPLACEMENTS (version_no >= 2), each with its
// own explicit storage_key. Replacing a file keeps every earlier version, and an approval keeps
// pointing at the exact version that was sent for approval.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_files
        ADD COLUMN IF NOT EXISTS category               TEXT    NOT NULL DEFAULT 'Other',
        ADD COLUMN IF NOT EXISTS portal_visibility      TEXT    NOT NULL DEFAULT 'internal',
        ADD COLUMN IF NOT EXISTS uploaded_by_side       TEXT    NOT NULL DEFAULT 'team',
        ADD COLUMN IF NOT EXISTS uploaded_by_contact_id UUID    REFERENCES client_contacts (id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS uploaded_by_name       TEXT,
        ADD COLUMN IF NOT EXISTS current_version        INTEGER NOT NULL DEFAULT 1;

    -- Existing rows were just filled with 'Other'; new uploads default to Deliverable.
    ALTER TABLE project_files ALTER COLUMN category SET DEFAULT 'Deliverable';

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'project_files'::regclass AND conname = 'project_files_category_check'
      ) THEN
        ALTER TABLE project_files
          ADD CONSTRAINT project_files_category_check
          CHECK (category IN ('Proposal', 'Requirements', 'Agreement', 'Design', 'Report',
                              'Deliverable', 'Supporting Document', 'Other'));
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'project_files'::regclass AND conname = 'project_files_portal_visibility_check'
      ) THEN
        ALTER TABLE project_files
          ADD CONSTRAINT project_files_portal_visibility_check
          CHECK (portal_visibility IN ('internal', 'client'));
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'project_files'::regclass AND conname = 'project_files_uploaded_by_side_check'
      ) THEN
        ALTER TABLE project_files
          ADD CONSTRAINT project_files_uploaded_by_side_check
          CHECK (uploaded_by_side IN ('team', 'client'));
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'project_files'::regclass AND conname = 'project_files_current_version_check'
      ) THEN
        ALTER TABLE project_files
          ADD CONSTRAINT project_files_current_version_check CHECK (current_version >= 1);
      END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_project_files_project_portal_visibility
        ON project_files (project_id, portal_visibility)
        WHERE status = 'active';

    CREATE TABLE IF NOT EXISTS project_file_versions (
        id                     UUID                     PRIMARY KEY DEFAULT uuid_generate_v4(),
        file_id                UUID                     NOT NULL REFERENCES project_files (id) ON DELETE CASCADE,
        version_no             INTEGER                  NOT NULL,
        storage_key            TEXT                     NOT NULL,
        size                   BIGINT                   NOT NULL DEFAULT 0,
        type                   TEXT                     NOT NULL,
        status                 TEXT                     NOT NULL DEFAULT 'pending',
        uploaded_by            UUID                     REFERENCES users (id) ON DELETE SET NULL,
        uploaded_by_contact_id UUID                     REFERENCES client_contacts (id) ON DELETE SET NULL,
        uploaded_by_name       TEXT                     NOT NULL DEFAULT '',
        created_at             TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT project_file_versions_version_check CHECK (version_no >= 2),
        CONSTRAINT project_file_versions_status_check CHECK (status IN ('pending', 'active')),
        CONSTRAINT project_file_versions_file_version_key UNIQUE (file_id, version_no)
    );

    CREATE INDEX IF NOT EXISTS idx_project_file_versions_pending
        ON project_file_versions (created_at)
        WHERE status = 'pending';

    COMMENT ON COLUMN project_files.portal_visibility IS
      'Client Portal v2: internal (default) or client. A hidden file is never listed, counted or downloadable by a client.';
    COMMENT ON COLUMN project_files.current_version IS
      'Latest active version. Version 1 is the project_files row itself; later versions are rows in project_file_versions.';
    COMMENT ON TABLE project_file_versions IS
      'Replacement versions (>= 2) of a project file. Earlier versions are kept; approvals pin the version they were sent for.';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  // Replacement versions are dropped with their rows; their storage objects must be removed
  // separately if this is ever reverted on a database that holds real versions.
  pgm.sql(`
    DROP TABLE IF EXISTS project_file_versions;

    DROP INDEX IF EXISTS idx_project_files_project_portal_visibility;

    ALTER TABLE project_files
        DROP CONSTRAINT IF EXISTS project_files_current_version_check,
        DROP CONSTRAINT IF EXISTS project_files_uploaded_by_side_check,
        DROP CONSTRAINT IF EXISTS project_files_portal_visibility_check,
        DROP CONSTRAINT IF EXISTS project_files_category_check;

    ALTER TABLE project_files
        DROP COLUMN IF EXISTS current_version,
        DROP COLUMN IF EXISTS uploaded_by_name,
        DROP COLUMN IF EXISTS uploaded_by_contact_id,
        DROP COLUMN IF EXISTS uploaded_by_side,
        DROP COLUMN IF EXISTS portal_visibility,
        DROP COLUMN IF EXISTS category;
  `);
};
