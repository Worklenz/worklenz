/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
  // Add new sort order columns for different grouping types
  pgm.addColumns('tasks', {
    status_sort_order: {
      type: 'integer',
      default: 0,
      notNull: false
    },
    priority_sort_order: {
      type: 'integer',
      default: 0,
      notNull: false
    },
    phase_sort_order: {
      type: 'integer',
      default: 0,
      notNull: false
    },
    member_sort_order: {
      type: 'integer',
      default: 0,
      notNull: false
    }
  }, { ifNotExists: true });

  // Initialize new columns with current sort_order values
  pgm.sql(`
    UPDATE tasks SET 
      status_sort_order = sort_order,
      priority_sort_order = sort_order,
      phase_sort_order = sort_order,
      member_sort_order = sort_order
    WHERE status_sort_order = 0 
       OR priority_sort_order = 0 
       OR phase_sort_order = 0 
       OR member_sort_order = 0
  `);

  // Add constraints to ensure non-negative values
  pgm.addConstraint('tasks', 'tasks_status_sort_order_check', {
    check: 'status_sort_order >= 0'
  }, { ifNotExists: true });
  
  pgm.addConstraint('tasks', 'tasks_priority_sort_order_check', {
    check: 'priority_sort_order >= 0'
  }, { ifNotExists: true });
  
  pgm.addConstraint('tasks', 'tasks_phase_sort_order_check', {
    check: 'phase_sort_order >= 0'
  }, { ifNotExists: true });
  
  pgm.addConstraint('tasks', 'tasks_member_sort_order_check', {
    check: 'member_sort_order >= 0'
  }, { ifNotExists: true });

  // Add indexes for performance
  pgm.createIndex('tasks', ['project_id', 'status_sort_order'], {
    name: 'idx_tasks_status_sort_order',
    ifNotExists: true
  });
  
  pgm.createIndex('tasks', ['project_id', 'priority_sort_order'], {
    name: 'idx_tasks_priority_sort_order',
    ifNotExists: true
  });
  
  pgm.createIndex('tasks', ['project_id', 'phase_sort_order'], {
    name: 'idx_tasks_phase_sort_order',
    ifNotExists: true
  });
  
  pgm.createIndex('tasks', ['project_id', 'member_sort_order'], {
    name: 'idx_tasks_member_sort_order',
    ifNotExists: true
  });

  // Add column comments for documentation
  pgm.sql("COMMENT ON COLUMN tasks.status_sort_order IS 'Sort order when grouped by status'");
  pgm.sql("COMMENT ON COLUMN tasks.priority_sort_order IS 'Sort order when grouped by priority'");
  pgm.sql("COMMENT ON COLUMN tasks.phase_sort_order IS 'Sort order when grouped by phase'");
  pgm.sql("COMMENT ON COLUMN tasks.member_sort_order IS 'Sort order when grouped by members/assignees'");
};

exports.down = pgm => {
  // Drop indexes
  pgm.dropIndex('tasks', ['project_id', 'member_sort_order'], { name: 'idx_tasks_member_sort_order', ifExists: true });
  pgm.dropIndex('tasks', ['project_id', 'phase_sort_order'], { name: 'idx_tasks_phase_sort_order', ifExists: true });
  pgm.dropIndex('tasks', ['project_id', 'priority_sort_order'], { name: 'idx_tasks_priority_sort_order', ifExists: true });
  pgm.dropIndex('tasks', ['project_id', 'status_sort_order'], { name: 'idx_tasks_status_sort_order', ifExists: true });

  // Drop constraints
  pgm.dropConstraint('tasks', 'tasks_member_sort_order_check', { ifExists: true });
  pgm.dropConstraint('tasks', 'tasks_phase_sort_order_check', { ifExists: true });
  pgm.dropConstraint('tasks', 'tasks_priority_sort_order_check', { ifExists: true });
  pgm.dropConstraint('tasks', 'tasks_status_sort_order_check', { ifExists: true });

  // Drop columns
  pgm.dropColumns('tasks', ['status_sort_order', 'priority_sort_order', 'phase_sort_order', 'member_sort_order'], { ifExists: true });
};