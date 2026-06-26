-- Final fix for same-day task capacity calculation
-- This migration completely fixes the issue where tasks with same start and end date
-- were not getting their estimation allocated properly

CREATE OR REPLACE FUNCTION calculate_member_capacity(
    p_team_member_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    date DATE,
    working_hours NUMERIC,
    allocated_hours NUMERIC,
    available_hours NUMERIC,
    utilization_percent NUMERIC,
    is_time_off BOOLEAN,
    is_holiday BOOLEAN,
    is_weekend BOOLEAN,
    status TEXT,
    projects JSONB
) AS $$
DECLARE
    v_organization_id UUID;
    v_hours_per_day NUMERIC;
BEGIN
    -- Get organization and working hours
    SELECT o.id, o.hours_per_day
    INTO v_organization_id, v_hours_per_day
    FROM team_members tm
    JOIN teams t ON tm.team_id = t.id
    JOIN organizations o ON t.organization_id = o.id
    WHERE tm.id = p_team_member_id
    LIMIT 1;

    -- If member not found, return empty
    IF v_organization_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    WITH RECURSIVE date_series AS (
        -- Generate all dates in range
        SELECT p_start_date::DATE AS series_date
        UNION ALL
        SELECT (series_date + INTERVAL '1 day')::DATE
        FROM date_series
        WHERE series_date < p_end_date
    ),
    working_days AS (
        -- Get organization working days configuration
        SELECT 
            monday, tuesday, wednesday, thursday, friday, saturday, sunday
        FROM organization_working_days
        WHERE organization_id = v_organization_id
        LIMIT 1
    ),
    date_info AS (
        -- Determine if each date is a working day
        SELECT 
            ds.series_date AS info_date,
            CASE 
                WHEN EXTRACT(ISODOW FROM ds.series_date) = 1 THEN wd.monday
                WHEN EXTRACT(ISODOW FROM ds.series_date) = 2 THEN wd.tuesday
                WHEN EXTRACT(ISODOW FROM ds.series_date) = 3 THEN wd.wednesday
                WHEN EXTRACT(ISODOW FROM ds.series_date) = 4 THEN wd.thursday
                WHEN EXTRACT(ISODOW FROM ds.series_date) = 5 THEN wd.friday
                WHEN EXTRACT(ISODOW FROM ds.series_date) = 6 THEN wd.saturday
                WHEN EXTRACT(ISODOW FROM ds.series_date) = 7 THEN wd.sunday
            END AS is_working_day,
            CASE 
                WHEN EXTRACT(ISODOW FROM ds.series_date) IN (6, 7) THEN true
                ELSE false
            END AS is_weekend_day
        FROM date_series ds
        CROSS JOIN working_days wd
    ),
    task_working_days AS (
        -- Pre-calculate working days for each task to avoid repeated calculations
        SELECT 
            t.id as task_id,
            t.project_id,
            t.start_date::DATE as task_start_date,
            t.end_date::DATE as task_end_date,
            t.total_minutes,
            p.name AS project_name,
            p.color_code,
            -- Calculate total working days for this task
            CASE 
                WHEN t.start_date::DATE = t.end_date::DATE THEN
                    -- Same day task: check if that day is a working day
                    CASE 
                        WHEN (EXTRACT(ISODOW FROM t.start_date::DATE) = 1 AND wd.monday = true) OR
                             (EXTRACT(ISODOW FROM t.start_date::DATE) = 2 AND wd.tuesday = true) OR
                             (EXTRACT(ISODOW FROM t.start_date::DATE) = 3 AND wd.wednesday = true) OR
                             (EXTRACT(ISODOW FROM t.start_date::DATE) = 4 AND wd.thursday = true) OR
                             (EXTRACT(ISODOW FROM t.start_date::DATE) = 5 AND wd.friday = true) OR
                             (EXTRACT(ISODOW FROM t.start_date::DATE) = 6 AND wd.saturday = true) OR
                             (EXTRACT(ISODOW FROM t.start_date::DATE) = 7 AND wd.sunday = true)
                        THEN 1
                        ELSE 0  -- Not a working day, so no allocation
                    END
                ELSE
                    -- Multi-day task: count working days in range
                    GREATEST(1, (
                        SELECT COUNT(*)
                        FROM generate_series(t.start_date::DATE, t.end_date::DATE, '1 day'::interval) AS task_day
                        WHERE 
                            (EXTRACT(ISODOW FROM task_day) = 1 AND wd.monday = true) OR
                            (EXTRACT(ISODOW FROM task_day) = 2 AND wd.tuesday = true) OR
                            (EXTRACT(ISODOW FROM task_day) = 3 AND wd.wednesday = true) OR
                            (EXTRACT(ISODOW FROM task_day) = 4 AND wd.thursday = true) OR
                            (EXTRACT(ISODOW FROM task_day) = 5 AND wd.friday = true) OR
                            (EXTRACT(ISODOW FROM task_day) = 6 AND wd.saturday = true) OR
                            (EXTRACT(ISODOW FROM task_day) = 7 AND wd.sunday = true)
                    ))
            END AS working_days_count
        FROM tasks t
        JOIN tasks_assignees ta ON t.id = ta.task_id
        JOIN project_members pm ON ta.project_member_id = pm.id
        JOIN projects p ON t.project_id = p.id
        CROSS JOIN working_days wd
        WHERE pm.team_member_id = p_team_member_id
            AND t.start_date IS NOT NULL 
            AND t.end_date IS NOT NULL
            AND t.archived = false
            -- Task overlaps with our date range
            AND t.start_date::DATE <= p_end_date
            AND t.end_date::DATE >= p_start_date
    ),
    task_allocations AS (
        -- Calculate daily task allocations based on task assignments and estimations
        SELECT 
            di.info_date AS alloc_date,
            twd.project_id,
            twd.project_name,
            twd.color_code,
            -- Distribute task estimation evenly across working days
            CASE 
                WHEN twd.working_days_count > 0 THEN
                    (twd.total_minutes / 60.0) / twd.working_days_count
                ELSE 0
            END AS daily_hours
        FROM date_info di
        JOIN task_working_days twd ON 
            di.info_date >= twd.task_start_date 
            AND di.info_date <= twd.task_end_date
            AND di.is_working_day = true
            AND twd.working_days_count > 0  -- Only include tasks that have working days
    ),
    project_summary AS (
        -- Aggregate allocations by project per day
        SELECT 
            alloc_date AS summary_date,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'project_id', project_id,
                        'project_name', project_name,
                        'allocated_hours', ROUND(daily_hours::numeric, 2),
                        'color_code', color_code
                    )
                    ORDER BY daily_hours DESC
                ) FILTER (WHERE daily_hours > 0),
                '[]'::jsonb
            ) AS projects,
            COALESCE(SUM(daily_hours), 0) AS total_allocated
        FROM task_allocations
        GROUP BY alloc_date
    )
    SELECT 
        di.info_date::DATE,
        CASE 
            WHEN di.is_working_day THEN v_hours_per_day
            ELSE 0
        END AS working_hours,
        COALESCE(ps.total_allocated, 0) AS allocated_hours,
        CASE 
            WHEN di.is_working_day THEN GREATEST(v_hours_per_day - COALESCE(ps.total_allocated, 0), 0)
            ELSE 0
        END AS available_hours,
        CASE 
            WHEN di.is_working_day AND v_hours_per_day > 0 
            THEN ROUND((COALESCE(ps.total_allocated, 0) / v_hours_per_day * 100)::numeric, 2)
            ELSE 0
        END AS utilization_percent,
        false AS is_time_off,
        false AS is_holiday,
        NOT di.is_working_day AS is_weekend,
        CASE 
            WHEN NOT di.is_working_day THEN 'unavailable'
            WHEN COALESCE(ps.total_allocated, 0) = 0 THEN 'available'
            WHEN COALESCE(ps.total_allocated, 0) > v_hours_per_day THEN 'overallocated'
            WHEN COALESCE(ps.total_allocated, 0) >= v_hours_per_day * 0.8 THEN 'fully-allocated'
            ELSE 'normal'
        END AS status,
        COALESCE(ps.projects, '[]'::jsonb) AS projects
    FROM date_info di
    LEFT JOIN project_summary ps ON di.info_date = ps.summary_date
    ORDER BY di.info_date;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION calculate_member_capacity(UUID, DATE, DATE) TO postgres;

COMMENT ON FUNCTION calculate_member_capacity IS 'Calculates daily capacity for a team member based on task assignments and estimations - Final fix for same-day tasks';