-- Function to create multiple recurring tasks in bulk
CREATE OR REPLACE FUNCTION create_bulk_recurring_tasks(
    p_tasks JSONB
)
RETURNS TABLE (
    task_id UUID,
    task_name TEXT,
    created BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_task JSONB;
    v_task_id UUID;
    v_existing_id UUID;
    v_error_message TEXT;
BEGIN
    -- Create a temporary table to store results
    CREATE TEMP TABLE IF NOT EXISTS bulk_task_results (
        task_id UUID,
        task_name TEXT,
        created BOOLEAN,
        error_message TEXT
    ) ON COMMIT DROP;

    -- Iterate through each task in the array
    FOR v_task IN SELECT * FROM jsonb_array_elements(p_tasks)
    LOOP
        BEGIN
            -- Check if task already exists for this schedule and date
            SELECT id INTO v_existing_id
            FROM tasks
            WHERE schedule_id = (v_task->>'schedule_id')::UUID
              AND end_date::DATE = (v_task->>'end_date')::DATE
            LIMIT 1;

            IF v_existing_id IS NOT NULL THEN
                -- Task already exists
                INSERT INTO bulk_task_results (task_id, task_name, created, error_message)
                VALUES (v_existing_id, v_task->>'name', FALSE, 'Task already exists for this date');
            ELSE
                -- Create the task using existing function
                SELECT (create_quick_task(v_task::TEXT)::JSONB)->>'id' INTO v_task_id;
                
                IF v_task_id IS NOT NULL THEN
                    INSERT INTO bulk_task_results (task_id, task_name, created, error_message)
                    VALUES (v_task_id::UUID, v_task->>'name', TRUE, NULL);
                ELSE
                    INSERT INTO bulk_task_results (task_id, task_name, created, error_message)
                    VALUES (NULL, v_task->>'name', FALSE, 'Failed to create task');
                END IF;
            END IF;
            
        EXCEPTION WHEN OTHERS THEN
            -- Capture any errors
            v_error_message := SQLERRM;
            INSERT INTO bulk_task_results (task_id, task_name, created, error_message)
            VALUES (NULL, v_task->>'name', FALSE, v_error_message);
        END;
    END LOOP;

    -- Return all results
    RETURN QUERY SELECT * FROM bulk_task_results;
END;
$$ LANGUAGE plpgsql;

-- Function to bulk assign team members to tasks
CREATE OR REPLACE FUNCTION bulk_assign_team_members(
    p_assignments JSONB
)
RETURNS TABLE (
    task_id UUID,
    team_member_id UUID,
    assigned BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_assignment JSONB;
    v_result RECORD;
BEGIN
    CREATE TEMP TABLE IF NOT EXISTS bulk_assignment_results (
        task_id UUID,
        team_member_id UUID,
        assigned BOOLEAN,
        error_message TEXT
    ) ON COMMIT DROP;

    FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_assignments)
    LOOP
        BEGIN
            -- Check if assignment already exists
            IF EXISTS (
                SELECT 1 FROM tasks_assignees
                WHERE task_id = (v_assignment->>'task_id')::UUID
                  AND team_member_id = (v_assignment->>'team_member_id')::UUID
            ) THEN
                INSERT INTO bulk_assignment_results
                VALUES (
                    (v_assignment->>'task_id')::UUID,
                    (v_assignment->>'team_member_id')::UUID,
                    FALSE,
                    'Assignment already exists'
                );
            ELSE
                -- Create the assignment
                INSERT INTO tasks_assignees (task_id, team_member_id, assigned_by)
                VALUES (
                    (v_assignment->>'task_id')::UUID,
                    (v_assignment->>'team_member_id')::UUID,
                    (v_assignment->>'assigned_by')::UUID
                );
                
                INSERT INTO bulk_assignment_results
                VALUES (
                    (v_assignment->>'task_id')::UUID,
                    (v_assignment->>'team_member_id')::UUID,
                    TRUE,
                    NULL
                );
            END IF;
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO bulk_assignment_results
            VALUES (
                (v_assignment->>'task_id')::UUID,
                (v_assignment->>'team_member_id')::UUID,
                FALSE,
                SQLERRM
            );
        END;
    END LOOP;

    RETURN QUERY SELECT * FROM bulk_assignment_results;
END;
$$ LANGUAGE plpgsql;

-- Function to bulk assign labels to tasks
CREATE OR REPLACE FUNCTION bulk_assign_labels(
    p_label_assignments JSONB
)
RETURNS TABLE (
    task_id UUID,
    label_id UUID,
    assigned BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    v_assignment JSONB;
    v_labels JSONB;
BEGIN
    CREATE TEMP TABLE IF NOT EXISTS bulk_label_results (
        task_id UUID,
        label_id UUID,
        assigned BOOLEAN,
        error_message TEXT
    ) ON COMMIT DROP;

    FOR v_assignment IN SELECT * FROM jsonb_array_elements(p_label_assignments)
    LOOP
        BEGIN
            -- Use existing function to add label
            SELECT add_or_remove_task_label(
                (v_assignment->>'task_id')::UUID,
                (v_assignment->>'label_id')::UUID
            ) INTO v_labels;
            
            INSERT INTO bulk_label_results
            VALUES (
                (v_assignment->>'task_id')::UUID,
                (v_assignment->>'label_id')::UUID,
                TRUE,
                NULL
            );
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO bulk_label_results
            VALUES (
                (v_assignment->>'task_id')::UUID,
                (v_assignment->>'label_id')::UUID,
                FALSE,
                SQLERRM
            );
        END;
    END LOOP;

    RETURN QUERY SELECT * FROM bulk_label_results;
END;
$$ LANGUAGE plpgsql;