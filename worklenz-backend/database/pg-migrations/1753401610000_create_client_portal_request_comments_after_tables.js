'use strict';

const { createRequestComments } = require('./1735689609000_create_client_portal_request_comments');

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * 1735689609000 skips itself on a fresh database because client_portal_requests
 * does not exist yet. All statements are IF NOT EXISTS, so this is a no-op where
 * the table was already created.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = async (pgm) => {
  createRequestComments(pgm);
};

exports.down = async (_pgm) => {};
