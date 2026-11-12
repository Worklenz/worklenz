'use strict';

// The legacy portal and the newer client portal used the same table name for
// incompatible schemas. Preserve both histories under separate table names.
exports.up = pgm => pgm.sql(`
  CREATE TABLE IF NOT EXISTS client_portal_contact_notification_reads (
    notification_id UUID NOT NULL REFERENCES client_portal_notifications (id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES client_contacts (id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (notification_id, contact_id)
  );
  CREATE INDEX IF NOT EXISTS idx_client_portal_contact_notification_reads_contact
    ON client_portal_contact_notification_reads (contact_id);
  DO $migration$
  BEGIN
    IF to_regclass('public.client_portal_notification_reads') IS NOT NULL
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_portal_notification_reads' AND column_name = 'notification_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_portal_notification_reads' AND column_name = 'contact_id') THEN
      INSERT INTO client_portal_contact_notification_reads (notification_id, contact_id, read_at)
      SELECT notification_id, contact_id, read_at FROM client_portal_notification_reads
      ON CONFLICT (notification_id, contact_id) DO NOTHING;
    END IF;
  END $migration$;
`);

// Retain the original table and the copied read history on rollback.
exports.down = () => {};
