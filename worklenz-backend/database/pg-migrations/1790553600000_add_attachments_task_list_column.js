exports.up = async function (pgm) {
  pgm.sql(`
    ALTER TYPE WL_TASK_LIST_COL_KEY
    ADD VALUE IF NOT EXISTS 'ATTACHMENTS' AFTER 'PHASE';
  `);
};

exports.down = async function () {
  // PostgreSQL enum values cannot be removed safely after they are committed.
};
