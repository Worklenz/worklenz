'use strict';

/**
 * Paddle Billing payments and refunds use ON CONFLICT (order_id). Some Worklenz databases were
 * created without the unique constraint present in the license manager's standalone schema.
 * Fail on historical duplicates rather than removing payment records automatically.
 */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS licensing_payment_details_order_id_uindex
      ON licensing_payment_details (order_id);
  `);
};

exports.down = async (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS licensing_payment_details_order_id_uindex;');
};
