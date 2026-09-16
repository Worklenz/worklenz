'use strict';
exports.shorthands = undefined;
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE google_calendar_task_links
      ADD COLUMN IF NOT EXISTS sync_direction TEXT;
    UPDATE google_calendar_task_links SET sync_direction = 'google_to_worklenz' WHERE sync_direction IS NULL;
    ALTER TABLE google_calendar_task_links
      ALTER COLUMN sync_direction SET DEFAULT 'worklenz_to_google',
      ALTER COLUMN sync_direction SET NOT NULL;
    DO $$ BEGIN
      ALTER TABLE google_calendar_task_links ADD CONSTRAINT google_calendar_task_links_sync_direction_check
        CHECK (sync_direction IN ('google_to_worklenz','worklenz_to_google'));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
};
exports.down = (pgm) => { pgm.sql(`ALTER TABLE google_calendar_task_links DROP CONSTRAINT IF EXISTS google_calendar_task_links_sync_direction_check; ALTER TABLE google_calendar_task_links DROP COLUMN IF EXISTS sync_direction;`); };
