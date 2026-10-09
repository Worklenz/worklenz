'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Comment foreign keys without ON DELETE CASCADE make remove_team_member()
 * fail for anyone who has commented, mentioned, or been mentioned on a task.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE task_comments
        DROP CONSTRAINT IF EXISTS task_comments_team_member_id_fk,
        ADD CONSTRAINT task_comments_team_member_id_fk
            FOREIGN KEY (team_member_id) REFERENCES team_members ON DELETE CASCADE;

    ALTER TABLE task_comment_mentions
        DROP CONSTRAINT IF EXISTS task_comment_mentions_informed_by_fk,
        ADD CONSTRAINT task_comment_mentions_informed_by_fk
            FOREIGN KEY (informed_by) REFERENCES team_members ON DELETE CASCADE;

    ALTER TABLE task_comment_contents
        DROP CONSTRAINT IF EXISTS task_comment_contents_team_member_fk,
        ADD CONSTRAINT task_comment_contents_team_member_fk
            FOREIGN KEY (team_member_id) REFERENCES team_members ON DELETE CASCADE;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE task_comments
        DROP CONSTRAINT IF EXISTS task_comments_team_member_id_fk,
        ADD CONSTRAINT task_comments_team_member_id_fk
            FOREIGN KEY (team_member_id) REFERENCES team_members;

    ALTER TABLE task_comment_mentions
        DROP CONSTRAINT IF EXISTS task_comment_mentions_informed_by_fk,
        ADD CONSTRAINT task_comment_mentions_informed_by_fk
            FOREIGN KEY (informed_by) REFERENCES team_members;

    ALTER TABLE task_comment_contents
        DROP CONSTRAINT IF EXISTS task_comment_contents_team_member_fk,
        ADD CONSTRAINT task_comment_contents_team_member_fk
            FOREIGN KEY (team_member_id) REFERENCES team_members;
  `);
};
