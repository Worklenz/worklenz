exports.up = (pgm) => {
  pgm.addColumn('projects', {
    status_category_order: { type: 'jsonb', notNull: false }
  });
};
exports.down = (pgm) => {
  pgm.dropColumn('projects', 'status_category_order');
};
