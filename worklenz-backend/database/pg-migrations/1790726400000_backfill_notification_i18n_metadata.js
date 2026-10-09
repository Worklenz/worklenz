'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Adds i18n metadata to known system notifications created before migration
 * 1790683200000_add_notification_translation_support.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = async (pgm) => {
  pgm.sql(`
    UPDATE user_notifications
    SET message_key = CASE
            WHEN message ~ '^<b>(.+)</b> has assigned you (in|to) <b>(.+)</b>$' THEN 'notifications.taskAssigned'
            WHEN message ~ '^<b>(.+)</b> has removed you from <b>(.+)</b>$' THEN 'notifications.taskRemoved'
            WHEN message ~ '^<b>(.+)</b> added a comment on <b>(.+)</b>( \\(.+\\))?$' THEN 'notifications.commentAdded'
            WHEN message ~ '^You have been added to the <b>(.+)</b> by <b>(.+)</b>$' THEN 'notifications.addedToProject'
        END,
        message_params = CASE
            WHEN message ~ '^<b>(.+)</b> has assigned you (in|to) <b>(.+)</b>$' THEN
                jsonb_build_object(
                    'reporter', (regexp_match(message, '^<b>(.+)</b> has assigned you (in|to) <b>(.+)</b>$'))[1],
                    'task', (regexp_match(message, '^<b>(.+)</b> has assigned you (in|to) <b>(.+)</b>$'))[3]
                )
            WHEN message ~ '^<b>(.+)</b> has removed you from <b>(.+)</b>$' THEN
                jsonb_build_object(
                    'reporter', (regexp_match(message, '^<b>(.+)</b> has removed you from <b>(.+)</b>$'))[1],
                    'task', (regexp_match(message, '^<b>(.+)</b> has removed you from <b>(.+)</b>$'))[2]
                )
            WHEN message ~ '^<b>(.+)</b> added a comment on <b>(.+)</b>( \\(.+\\))?$' THEN
                jsonb_build_object(
                    'user', (regexp_match(message, '^<b>(.+)</b> added a comment on <b>(.+)</b>( \\(.+\\))?$'))[1],
                    'task', (regexp_match(message, '^<b>(.+)</b> added a comment on <b>(.+)</b>( \\(.+\\))?$'))[2]
                )
            WHEN message ~ '^You have been added to the <b>(.+)</b> by <b>(.+)</b>$' THEN
                jsonb_build_object(
                    'project', (regexp_match(message, '^You have been added to the <b>(.+)</b> by <b>(.+)</b>$'))[1],
                    'user', (regexp_match(message, '^You have been added to the <b>(.+)</b> by <b>(.+)</b>$'))[2]
                )
        END,
        notification_type_key = COALESCE(notification_type_key, CASE
            WHEN message ~ '^<b>(.+)</b> has assigned you (in|to) <b>(.+)</b>$' THEN 'TASK_ASSIGNMENT'
            WHEN message ~ '^<b>(.+)</b> has removed you from <b>(.+)</b>$' THEN 'TASK_UNASSIGN'
            WHEN message ~ '^<b>(.+)</b> added a comment on <b>(.+)</b>( \\(.+\\))?$' THEN 'COMMENT_ADDED'
            WHEN message ~ '^You have been added to the <b>(.+)</b> by <b>(.+)</b>$' THEN 'PROJECT_MEMBER_ADDED'
        END)
    WHERE message_key IS NULL
      AND (
          message ~ '^<b>(.+)</b> has assigned you (in|to) <b>(.+)</b>$'
          OR message ~ '^<b>(.+)</b> has removed you from <b>(.+)</b>$'
          OR message ~ '^<b>(.+)</b> added a comment on <b>(.+)</b>( \\(.+\\))?$'
          OR message ~ '^You have been added to the <b>(.+)</b> by <b>(.+)</b>$'
      );
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Intentionally irreversible: clearing metadata could affect notifications
  // created after this migration has run.
};
