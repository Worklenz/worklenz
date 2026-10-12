'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
ALTER TABLE member_time_off
    ADD COLUMN IF NOT EXISTS is_full_day BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS hours_off NUMERIC(4, 2),
    ADD COLUMN IF NOT EXISTS timezone VARCHAR(100),
    ADD COLUMN IF NOT EXISTS type VARCHAR(50);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'member_time_off_type_check'
    ) THEN
        ALTER TABLE member_time_off
            ADD CONSTRAINT member_time_off_type_check
            CHECK (type IS NULL OR type IN ('vacation', 'sick', 'personal', 'other'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_member_time_off_type ON member_time_off(type);

DROP FUNCTION IF EXISTS calculate_member_capacity(UUID, DATE, DATE);

CREATE OR REPLACE FUNCTION calculate_member_capacity(
    p_team_member_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    date DATE,
    base_hours NUMERIC,
    holiday_hours NUMERIC,
    time_off_hours NUMERIC,
    effective_working_hours NUMERIC,
    working_hours NUMERIC,
    allocated_hours NUMERIC,
    available_hours NUMERIC,
    utilization_percent NUMERIC,
    is_time_off BOOLEAN,
    is_holiday BOOLEAN,
    is_weekend BOOLEAN,
    is_full_day_time_off BOOLEAN,
    time_off_type TEXT,
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
            o.id AS organization_id,
            o.hours_per_day,
            owd.monday,
            owd.tuesday,
            owd.wednesday,
            owd.thursday,
            owd.friday,
            owd.saturday,
            owd.sunday
        FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        JOIN organizations o ON t.organization_id = o.id
        JOIN organization_working_days owd ON owd.organization_id = o.id
        WHERE tm.id = p_team_member_id
        LIMIT 1
    ),
    day_flags AS (
        SELECT
            ds.date,
            os.organization_id,
            os.hours_per_day,
            CASE
                WHEN EXTRACT(DOW FROM ds.date) = 0 THEN os.sunday
                WHEN EXTRACT(DOW FROM ds.date) = 1 THEN os.monday
                WHEN EXTRACT(DOW FROM ds.date) = 2 THEN os.tuesday
                WHEN EXTRACT(DOW FROM ds.date) = 3 THEN os.wednesday
                WHEN EXTRACT(DOW FROM ds.date) = 4 THEN os.thursday
                WHEN EXTRACT(DOW FROM ds.date) = 5 THEN os.friday
                WHEN EXTRACT(DOW FROM ds.date) = 6 THEN os.saturday
                ELSE FALSE
            END AS is_working_day,
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
    ),
    holiday_check AS (
        SELECT
            df.date,
            EXISTS (
                SELECT 1
                FROM organization_holidays oh
                WHERE oh.organization_id = df.organization_id
                  AND (
                    oh.date = df.date
                    OR (
                      oh.is_recurring = TRUE
                      AND EXTRACT(MONTH FROM oh.date) = EXTRACT(MONTH FROM df.date)
                      AND EXTRACT(DAY FROM oh.date) = EXTRACT(DAY FROM df.date)
                    )
                  )
            ) AS is_holiday
        FROM day_flags df
    ),
    time_off_check AS (
        SELECT
            df.date,
            COALESCE(
                SUM(
                    CASE
                        WHEN mto.is_full_day THEN df.hours_per_day
                        ELSE LEAST(COALESCE(mto.hours_off, 0), df.hours_per_day)
                    END
                ),
                0
            ) AS total_time_off_hours,
            COALESCE(BOOL_OR(mto.is_full_day), FALSE) AS is_full_day_time_off,
            NULLIF(string_agg(DISTINCT mto.type, ', '), '') AS time_off_type
        FROM day_flags df
        LEFT JOIN member_time_off mto
            ON mto.team_member_id = p_team_member_id
            AND mto.start_date::DATE <= df.date
            AND mto.end_date::DATE >= df.date
        GROUP BY df.date, df.hours_per_day
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
    capacity_calc AS (
        SELECT
            df.date,
            CASE
                WHEN df.is_working_day THEN df.hours_per_day
                ELSE 0
            END AS base_hours,
            CASE
                WHEN df.is_working_day AND hc.is_holiday THEN df.hours_per_day
                ELSE 0
            END AS holiday_hours,
            CASE
                WHEN df.is_working_day AND NOT hc.is_holiday THEN LEAST(toc.total_time_off_hours, df.hours_per_day)
                ELSE 0
            END AS time_off_hours,
            da.allocated_hours,
            da.projects,
            hc.is_holiday,
            df.is_weekend,
            toc.is_full_day_time_off,
            toc.time_off_type
        FROM day_flags df
        JOIN holiday_check hc ON hc.date = df.date
        JOIN time_off_check toc ON toc.date = df.date
        LEFT JOIN daily_allocations da ON da.date = df.date
    )
    SELECT
        cc.date,
        cc.base_hours,
        cc.holiday_hours,
        cc.time_off_hours,
        GREATEST(cc.base_hours - cc.holiday_hours - cc.time_off_hours, 0) AS effective_working_hours,
        GREATEST(cc.base_hours - cc.holiday_hours - cc.time_off_hours, 0) AS working_hours,
        cc.allocated_hours,
        GREATEST(GREATEST(cc.base_hours - cc.holiday_hours - cc.time_off_hours, 0) - cc.allocated_hours, 0) AS available_hours,
        CASE
            WHEN GREATEST(cc.base_hours - cc.holiday_hours - cc.time_off_hours, 0) > 0 THEN
                ROUND((cc.allocated_hours / GREATEST(cc.base_hours - cc.holiday_hours - cc.time_off_hours, 0)) * 100, 2)
            ELSE 0
        END AS utilization_percent,
        cc.time_off_hours > 0 AS is_time_off,
        cc.is_holiday,
        cc.is_weekend,
        cc.is_full_day_time_off,
        cc.time_off_type,
        CASE
            WHEN GREATEST(cc.base_hours - cc.holiday_hours - cc.time_off_hours, 0) = 0 THEN 'unavailable'
            WHEN cc.allocated_hours > GREATEST(cc.base_hours - cc.holiday_hours - cc.time_off_hours, 0) THEN 'overallocated'
            WHEN cc.allocated_hours = GREATEST(cc.base_hours - cc.holiday_hours - cc.time_off_hours, 0) THEN 'fully-allocated'
            WHEN cc.allocated_hours >= GREATEST(cc.base_hours - cc.holiday_hours - cc.time_off_hours, 0) * 0.75 THEN 'normal'
            ELSE 'available'
        END AS status,
        cc.projects
    FROM capacity_calc cc
    ORDER BY cc.date;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION calculate_member_capacity IS
'Calculates daily member capacity with working days, holidays, and full/partial time-off adjustments.';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // manual rollback
};
