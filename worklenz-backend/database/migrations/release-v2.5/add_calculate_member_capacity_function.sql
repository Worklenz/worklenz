-- Function to calculate daily capacity for a team member based on task assignments
-- This function considers:
-- 1. Task assignments with start/end dates
-- 2. Task estimations (total_minutes)
-- 3. Organization working days and hours
-- 4. Time-off periods
-- 5. Holidays

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
    task_allocations AS (
        -- Calculate daily task allocations based on task assignments and estimations
        SELECT 
            di.info_date AS alloc_date,
            t.project_id,
            p.name AS project_name,
            p.color_code,
            -- Distribute task estimation evenly across working days in task date range
            CASE 
                WHEN t.start_date IS NOT NULL AND t.end_date IS NOT NULL THEN
                    (t.total_minutes / 60.0) / NULLIF(
                        (
                            SELECT COUNT(*)
                            FROM generate_series(t.start_date::DATE, t.end_date::DATE, '1 day'::interval) AS task_day
                            JOIN organization_working_days owd ON owd.organization_id = v_organization_id
                            WHERE 
                                (EXTRACT(ISODOW FROM task_day) = 1 AND owd.monday = true) OR
                                (EXTRACT(ISODOW FROM task_day) = 2 AND owd.tuesday = true) OR
                                (EXTRACT(ISODOW FROM task_day) = 3 AND owd.wednesday = true) OR
                                (EXTRACT(ISODOW FROM task_day) = 4 AND owd.thursday = true) OR
                                (EXTRACT(ISODOW FROM task_day) = 5 AND owd.friday = true) OR
                                (EXTRACT(ISODOW FROM task_day) = 6 AND owd.saturday = true) OR
                                (EXTRACT(ISODOW FROM task_day) = 7 AND owd.sunday = true)
                        ), 1
                    )
                ELSE 0
            END AS daily_hours
        FROM date_info di
        JOIN tasks t ON 
            t.start_date IS NOT NULL 
            AND t.end_date IS NOT NULL
            AND di.info_date BETWEEN t.start_date::DATE AND t.end_date::DATE
            AND t.archived = false
        JOIN tasks_assignees ta ON t.id = ta.task_id
        JOIN project_members pm ON ta.project_member_id = pm.id
        JOIN projects p ON t.project_id = p.id
        WHERE pm.team_member_id = p_team_member_id
            AND di.is_working_day = true
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

COMMENT ON FUNCTION calculate_member_capacity IS 'Calculates daily capacity for a team member based on task assignments and estimations';
