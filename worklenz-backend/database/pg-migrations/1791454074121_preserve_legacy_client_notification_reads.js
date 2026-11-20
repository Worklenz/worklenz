'use strict';

// An earlier migration used this table name for client-wide notification reads.
// Preserve those rows under a separate name before the per-contact table is created.
exports.up = pgm => {
  pgm.sql(`
    DO $$
    BEGIN
      IF to_regclass('public.client_portal_notification_reads') IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'client_portal_notification_reads'
             AND column_name = 'contact_id'
         ) THEN
        IF to_regclass('public.client_portal_notification_reads_legacy') IS NOT NULL THEN
          RAISE EXCEPTION 'Cannot preserve legacy notification reads: backup table already exists';
        END IF;
        ALTER TABLE public.client_portal_notification_reads
          RENAME TO client_portal_notification_reads_legacy;
      END IF;
    END;
    $$;
  `);
};

// The per-contact migration may have added new data. A rollback must first reconcile
// that data with the preserved legacy table; never drop either table automatically.
exports.down = () => {};
