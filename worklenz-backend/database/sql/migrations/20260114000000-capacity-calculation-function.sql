-- =====================================================
-- Migration: Add Capacity Calculation Function
-- Date: 2026-01-14
-- Purpose: Real-time capacity tracking for schedule
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS calculate_member_capacity(UUID, DATE, DATE);

-- Create capacity calculation function
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
BEGIN
    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::DATE AS date
    ),
    org_settings AS (
        SELECT 
            o.hours_per_day,
            owd.monday, owd.tuesday, owd.wednesday, owd.thursday, 
            owd.friday, owd.saturday, owd.sunday
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN organizations o ON t.organization_id = o.id
        JOIN organization_working_days owd ON o.id = owd.organization_id
        WHERE tm.id = p_team_member_id
        LIMIT 1
    ),
    daily_allocations AS (
        SELECT 
            ds.date,
            COALESCE(SUM(pma.seconds_per_day) / 3600.0, 0) AS allocated_hours,
            COALESCE(
                jsonb_agg(
                    jsonb_build_object(
                        'project_id', pma.project_id,
                        'project_name', p.name,
                        'allocated_hours', ROUND((pma.seconds_per_day / 3600.0)::NUMERIC, 2),
                        'color_code', p.color_code
                    )
                ) FILTER (WHERE pma.id IS NOT NULL),
                '[]'::jsonb
            ) AS projects
        FROM date_series ds
        LEFT JOIN project_member_allocations pma 
            ON pma.team_member_id = p_team_member_id
            AND ds.date BETWEEN pma.allocated_from AND pma.allocated_to
        LEFT JOIN projects p ON pma.project_id = p.id
        GROUP BY ds.date
    ),
    time_off_check AS (
        SELECT 
            ds.date,
            EXISTS(
                SELECT 1 FROM member_time_off mto
                WHERE mto.team_member_id = p_team_member_id
                AND ds.date::TIMESTAMP BETWEEN mto.start_date AND mto.end_date
            ) AS is_time_off
        FROM date_series ds
    ),
    capacity_calc AS (
        SELECT 
            ds.date,
            CASE 
                WHEN EXTRACT(DOW FROM ds.date) = 0 AND NOT os.sunday THEN 0
                WHEN EXTRACT(DOW FROM ds.date) = 1 AND NOT os.monday THEN 0
                WHEN EXTRACT(DOW FROM ds.date) = 2 AND NOT os.tuesday THEN 0
                WHEN EXTRACT(DOW FROM ds.date) = 3 AND NOT os.wednesday THEN 0
                WHEN EXTRACT(DOW FROM ds.date) = 4 AND NOT os.thursday THEN 0
                WHEN EXTRACT(DOW FROM ds.date) = 5 AND NOT os.friday THEN 0
                WHEN EXTRACT(DOW FROM ds.date) = 6 AND NOT os.saturday THEN 0
                WHEN toc.is_time_off THEN 0
                ELSE os.hours_per_day
            END AS working_hours,
            da.allocated_hours,
            da.projects,
            toc.is_time_off,
            FALSE AS is_holiday,
            CASE 
                WHEN EXTRACT(DOW FROM ds.date) = 0 AND NOT os.sunday THEN TRUE
                WHEN EXTRACT(DOW FROM ds.date) = 1 AND NOT os.monday THEN TRUE
                WHEN EXTRACT(DOW FROM ds.date) = 2 AND NOT os.tuesday THEN TRUE
                WHEN EXTRACT(DOW FROM ds.date) = 3 AND NOT os.wednesday THEN TRUE
                WHEN EXTRACT(DOW FROM ds.date) = 4 AND NOT os.thursday THEN TRUE
                WHEN EXTRACT(DOW FROM ds.date) = 5 AND NOT os.friday THEN TRUE
                WHEN EXTRACT(DOW FROM ds.date) = 6 AND NOT os.saturday THEN TRUE
                ELSE FALSE
            END AS is_weekend
        FROM date_series ds
        CROSS JOIN org_settings os
        LEFT JOIN daily_allocations da ON ds.date = da.date
        LEFT JOIN time_off_check toc ON ds.date = toc.date
    )
    SELECT 
        cc.date,
        cc.working_hours,
        cc.allocated_hours,
        GREATEST(0, cc.working_hours - cc.allocated_hours) AS available_hours,
        CASE 
            WHEN cc.working_hours > 0 THEN 
                ROUND((cc.allocated_hours / cc.working_hours) * 100, 2)
            ELSE 0
        END AS utilization_percent,
        cc.is_time_off,
        cc.is_holiday,
        cc.is_weekend,
        CASE 
            WHEN cc.is_time_off OR cc.is_weekend THEN 'unavailable'
            WHEN cc.working_hours = 0 THEN 'unavailable'
            WHEN cc.allocated_hours > cc.working_hours THEN 'overallocated'
            WHEN cc.allocated_hours = cc.working_hours THEN 'fully-allocated'
            WHEN cc.allocated_hours >= cc.working_hours * 0.75 THEN 'normal'
            ELSE 'available'
        END AS status,
        cc.projects
    FROM capacity_calc cc
    ORDER BY cc.date;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_pma_member_date_range 
ON project_member_allocations(team_member_id, allocated_from, allocated_to);

-- Comment for documentation
COMMENT ON FUNCTION calculate_member_capacity IS 
'Calculates daily capacity, utilization, and availability for a team member over a date range. 
Factors in working days, time-off, and project allocations.';

-- Test the function
-- SELECT * FROM calculate_member_capacity(
--     'your-team-member-uuid'::UUID,
--     '2026-01-13'::DATE,
--     '2026-02-13'::DATE
-- );
