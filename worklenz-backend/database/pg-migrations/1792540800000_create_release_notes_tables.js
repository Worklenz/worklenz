'use strict';
// Moves What's New release notes from markdown files (worklenz-backend/release-notes/)
// into the database so they can be authored in the admin app. Read by
// whats-new.service.ts; written by worklenz-admin's release-notes controller.
// IF NOT EXISTS throughout: a database the admin app already created them in is left as is.

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
CREATE TABLE IF NOT EXISTS release_notes (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug         VARCHAR(100) NOT NULL UNIQUE,
    published_at DATE NOT NULL,
    changelog_url TEXT,
    is_active    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS release_note_translations (
    release_note_id UUID NOT NULL REFERENCES release_notes(id) ON DELETE CASCADE,
    locale          VARCHAR(10) NOT NULL,
    title           VARCHAR(120) NOT NULL,
    body_markdown   TEXT NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (release_note_id, locale)
);

CREATE TABLE IF NOT EXISTS user_release_views (
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    release_id      VARCHAR(255) NOT NULL,
    view_count      INTEGER NOT NULL DEFAULT 1,
    first_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_viewed_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, release_id)
);

CREATE INDEX IF NOT EXISTS idx_user_release_views_release ON user_release_views(release_id);

COMMENT ON TABLE release_notes IS
    'What''s New releases. slug is the release id used by user_release_dismissals, user_notifications.release_id and user_release_views.release_id (no FK).';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} _pgm */
exports.down = async (_pgm) => {
  // Not run as part of the initial implementation — review manually before running migrate:down.
};
