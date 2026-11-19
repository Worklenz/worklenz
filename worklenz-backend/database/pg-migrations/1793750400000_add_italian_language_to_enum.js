'use strict';

exports.up = async (pgm) => {
  pgm.sql("ALTER TYPE LANGUAGE_TYPE ADD VALUE IF NOT EXISTS 'it';");
};

exports.down = async (_pgm) => {
  // PostgreSQL cannot remove an enum value without recreating the type.
};
