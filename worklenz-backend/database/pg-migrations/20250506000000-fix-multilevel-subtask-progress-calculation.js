/* eslint-disable camelcase */

exports.shorthands = undefined;
exports.noTransaction = false;

exports.up = pgm => {
  // First, check if progress_value column exists, if not create it
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'progress_value'
      ) THEN
        ALTER TABLE tasks ADD COLUMN progress_value FLOAT DEFAULT 0;
        RAISE NOTICE 'Added progress_value column to tasks table';
      END IF;
    END $$;
  `);

  // Also check for other columns that might be missing
  pgm.sql(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'weight'
      ) THEN
        ALTER TABLE tasks ADD COLUMN weight INTEGER DEFAULT 0;
        RAISE NOTICE 'Added weight column to tasks table';
      END IF;
      
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'total_minutes'
      ) THEN
        ALTER TABLE tasks ADD COLUMN total_minutes INTEGER DEFAULT 0;
        RAISE NOTICE 'Added total_minutes column to tasks table';
      END IF;
      
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'manual_progress'
      ) THEN
        ALTER TABLE tasks ADD COLUMN manual_progress BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added manual_progress column to tasks table';
      END IF;
    END $$;
  `);

  pgm.sql(`
    CREATE OR REPLACE FUNCTION update_parent_task_progress() RETURNS TRIGGER AS
    $$
    DECLARE
        _parent_task_id UUID;
        _project_id UUID;
        _ratio FLOAT;
    BEGIN
        -- Check if this is a subtask
        IF NEW.parent_task_id IS NOT NULL THEN
            _parent_task_id := NEW.parent_task_id;
            
            -- Force any parent task with subtasks to NOT use manual progress
            UPDATE tasks
            SET manual_progress = FALSE
            WHERE id = _parent_task_id;
            
            -- Calculate and update the parent's progress value
            SELECT (get_task_complete_ratio(_parent_task_id)->>'ratio')::FLOAT INTO _ratio;
            
            -- Update the parent's progress value
            UPDATE tasks
            SET progress_value = _ratio
            WHERE id = _parent_task_id;
            
            -- Recursively propagate changes up the hierarchy by using a recursive CTE
            WITH RECURSIVE task_hierarchy AS (
                -- Base case: Start with the parent task
                SELECT 
                    id,
                    parent_task_id
                FROM tasks
                WHERE id = _parent_task_id
                
                UNION ALL
                
                -- Recursive case: Go up to each ancestor
                SELECT 
                    t.id,
                    t.parent_task_id
                FROM tasks t
                JOIN task_hierarchy th ON t.id = th.parent_task_id
                WHERE t.id IS NOT NULL
            )
            -- For each ancestor, recalculate its progress
            UPDATE tasks
            SET 
                manual_progress = FALSE,
                progress_value = (SELECT (get_task_complete_ratio(task_hierarchy.id)->>'ratio')::FLOAT)
            FROM task_hierarchy
            WHERE tasks.id = task_hierarchy.id
            AND task_hierarchy.parent_task_id IS NOT NULL;
            
            -- Log the recalculation for debugging
            RAISE NOTICE 'Updated progress for task % to %', _parent_task_id, _ratio;
        END IF;
        
        -- If this task has progress value of 100 and doesn't have subtasks, we might want to prompt the user
        -- to mark it as done. We'll annotate this in a way that the socket handler can detect.
        IF NEW.progress_value = 100 OR NEW.weight = 100 OR NEW.total_minutes > 0 THEN
            -- Check if task has status in "done" category
            SELECT project_id FROM tasks WHERE id = NEW.id INTO _project_id;
            
            -- Get the progress ratio for this task
            SELECT (get_task_complete_ratio(NEW.id)->>'ratio')::FLOAT INTO _ratio;
            
            IF _ratio >= 100 THEN
                -- Log that this task is at 100% progress
                RAISE NOTICE 'Task % progress is at 100%%, may need status update', NEW.id;
            END IF;
        END IF;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql(`
    DROP TRIGGER IF EXISTS update_parent_task_progress_trigger ON tasks;
    CREATE TRIGGER update_parent_task_progress_trigger
    AFTER UPDATE OF progress_value, weight, total_minutes, parent_task_id, manual_progress ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_parent_task_progress();
  `);

  pgm.sql(`
    DROP TRIGGER IF EXISTS update_parent_task_progress_on_insert_trigger ON tasks;
    CREATE TRIGGER update_parent_task_progress_on_insert_trigger
    AFTER INSERT ON tasks
    FOR EACH ROW
    WHEN (NEW.parent_task_id IS NOT NULL)
    EXECUTE FUNCTION update_parent_task_progress();
  `);

  pgm.sql(`
    COMMENT ON FUNCTION update_parent_task_progress() IS 
    'This function recursively updates progress values for all ancestors when a task''s progress changes.
    The previous version only updated the immediate parent, which led to incorrect progress values for
    higher-level parent tasks when using weighted or manual progress calculations with multi-level subtasks.';
  `);

  pgm.sql(`
    CREATE OR REPLACE FUNCTION recalculate_all_task_progress() RETURNS void AS
    $$
    BEGIN
        -- First, reset manual_progress flag for all tasks that have subtasks
        UPDATE tasks AS t
        SET manual_progress = FALSE
        WHERE EXISTS (
            SELECT 1
            FROM tasks
            WHERE parent_task_id = t.id
            AND archived IS FALSE
        );
        
        -- Start recalculation from leaf tasks (no subtasks) and propagate upward
        -- This ensures calculations are done in the right order
        WITH RECURSIVE task_hierarchy AS (
            -- Base case: Start with all leaf tasks (no subtasks)
            SELECT 
                id,
                parent_task_id,
                0 AS level
            FROM tasks
            WHERE NOT EXISTS (
                SELECT 1 FROM tasks AS sub
                WHERE sub.parent_task_id = tasks.id
                AND sub.archived IS FALSE
            )
            AND archived IS FALSE
            
            UNION ALL
            
            -- Recursive case: Move up to parent tasks, but only after processing all their children
            SELECT 
                t.id,
                t.parent_task_id,
                th.level + 1
            FROM tasks t
            JOIN task_hierarchy th ON t.id = th.parent_task_id
            WHERE t.archived IS FALSE
        ),
        ordered_tasks AS (
            SELECT DISTINCT id, level
            FROM task_hierarchy
            ORDER BY level ASC
        )
        -- Sort by level to ensure we calculate in the right order (leaves first, then parents)
        -- This ensures we're using already updated progress values
        UPDATE tasks
        SET progress_value = (SELECT (get_task_complete_ratio(tasks.id)->>'ratio')::FLOAT)
        FROM ordered_tasks
        WHERE tasks.id = ordered_tasks.id
        AND (manual_progress IS FALSE OR manual_progress IS NULL);
        
        -- Log the completion of the recalculation
        RAISE NOTICE 'Finished recalculating all task progress values';
    END;
    $$ LANGUAGE plpgsql;
  `);

  pgm.sql('SELECT recalculate_all_task_progress();');
};

exports.down = pgm => {
  pgm.sql('DROP FUNCTION IF EXISTS recalculate_all_task_progress();');
  pgm.sql('DROP TRIGGER IF EXISTS update_parent_task_progress_on_insert_trigger ON tasks;');
  pgm.sql('DROP TRIGGER IF EXISTS update_parent_task_progress_trigger ON tasks;');
  pgm.sql('DROP FUNCTION IF EXISTS update_parent_task_progress();');
};