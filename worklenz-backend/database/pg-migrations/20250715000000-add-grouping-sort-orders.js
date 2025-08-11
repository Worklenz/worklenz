/* eslint-disable camelcase */

exports.shorthands = undefined;
exports.noTransaction = true;

exports.up = pgm => {
  // Add columns if they don't exist
  pgm.sql(`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS status_sort_order integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS priority_sort_order integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS phase_sort_order integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS member_sort_order integer DEFAULT 0
  `);

  // Update existing records
  pgm.sql(`
    UPDATE tasks SET 
      status_sort_order = sort_order,
      priority_sort_order = sort_order,
      phase_sort_order = sort_order,
      member_sort_order = sort_order
    WHERE status_sort_order = 0 
       OR priority_sort_order = 0 
       OR phase_sort_order = 0 
       OR member_sort_order = 0;
  `);

  // Add constraints only if they don't exist
  pgm.sql(`
    DO $$ 
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'tasks_status_sort_order_check' 
            AND conrelid = 'tasks'::regclass
        ) THEN
            ALTER TABLE tasks ADD CONSTRAINT tasks_status_sort_order_check CHECK (status_sort_order >= 0);
        END IF;
    END $$;
  `);

  pgm.sql(`
    DO $$ 
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'tasks_priority_sort_order_check' 
            AND conrelid = 'tasks'::regclass
        ) THEN
            ALTER TABLE tasks ADD CONSTRAINT tasks_priority_sort_order_check CHECK (priority_sort_order >= 0);
        END IF;
    END $$;
  `);

  pgm.sql(`
    DO $$ 
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'tasks_phase_sort_order_check' 
            AND conrelid = 'tasks'::regclass
        ) THEN
            ALTER TABLE tasks ADD CONSTRAINT tasks_phase_sort_order_check CHECK (phase_sort_order >= 0);
        END IF;
    END $$;
  `);

  pgm.sql(`
    DO $$ 
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conname = 'tasks_member_sort_order_check' 
            AND conrelid = 'tasks'::regclass
        ) THEN
            ALTER TABLE tasks ADD CONSTRAINT tasks_member_sort_order_check CHECK (member_sort_order >= 0);
        END IF;
    END $$;
  `);

  // Create indexes
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_tasks_status_sort_order ON tasks(project_id, status_sort_order);
    CREATE INDEX IF NOT EXISTS idx_tasks_priority_sort_order ON tasks(project_id, priority_sort_order);
    CREATE INDEX IF NOT EXISTS idx_tasks_phase_sort_order ON tasks(project_id, phase_sort_order);
    CREATE INDEX IF NOT EXISTS idx_tasks_member_sort_order ON tasks(project_id, member_sort_order);
  `);

  // Add comments
  pgm.sql(`COMMENT ON COLUMN tasks.status_sort_order IS 'Sort order when grouped by status';`);
  pgm.sql(`COMMENT ON COLUMN tasks.priority_sort_order IS 'Sort order when grouped by priority';`);
  pgm.sql(`COMMENT ON COLUMN tasks.phase_sort_order IS 'Sort order when grouped by phase';`);
  pgm.sql(`COMMENT ON COLUMN tasks.member_sort_order IS 'Sort order when grouped by members/assignees';`);
};

exports.down = pgm => {
  // Remove constraints
  pgm.sql('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_member_sort_order_check;');
  pgm.sql('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_phase_sort_order_check;');
  pgm.sql('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_sort_order_check;');
  pgm.sql('ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_sort_order_check;');
  
  // Remove indexes
  pgm.sql('DROP INDEX IF EXISTS idx_tasks_member_sort_order;');
  pgm.sql('DROP INDEX IF EXISTS idx_tasks_phase_sort_order;');
  pgm.sql('DROP INDEX IF EXISTS idx_tasks_priority_sort_order;');
  pgm.sql('DROP INDEX IF EXISTS idx_tasks_status_sort_order;');
  
  // Remove columns
  pgm.sql(`
    ALTER TABLE tasks 
    DROP COLUMN IF EXISTS member_sort_order,
    DROP COLUMN IF EXISTS phase_sort_order,
    DROP COLUMN IF EXISTS priority_sort_order,
    DROP COLUMN IF EXISTS status_sort_order;
  `);
};
