exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE pt_project_templates
      ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'general'
      CHECK (project_type IN ('general', 'software'));
  `);
};

exports.down = pgm => {
  pgm.sql('ALTER TABLE pt_project_templates DROP COLUMN project_type');
};
