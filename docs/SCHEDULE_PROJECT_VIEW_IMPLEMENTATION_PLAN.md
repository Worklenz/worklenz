# 🚀 Schedule Project View - Implementation Plan

**Priority:** HIGH  
**Estimated Time:** 3-4 weeks  
**Complexity:** Medium-High

---

## 📋 Implementation Phases

### Phase 1: Database Enhancements (Week 1)
### Phase 2: Backend API Development (Week 1-2)
### Phase 3: Frontend Components (Week 2-3)
### Phase 4: Integration & Testing (Week 3-4)

---

## Phase 1: Database Enhancements

### 1.1 Add Missing Columns to Existing Tables

**File:** `worklenz-backend/database/sql/migrations/20260114000000-enhance-schedule-tables.sql`

```sql
-- Add tentative flag to allocations
ALTER TABLE project_member_allocations 
ADD COLUMN IF NOT EXISTS is_tentative BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS allocation_percentage INTEGER DEFAULT 100 CHECK (allocation_percentage BETWEEN 1 AND 100),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Add hourly rate tracking
ALTER TABLE project_member_allocations
ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS cost_per_day NUMERIC(10,2);

-- Create index for date range queries
CREATE INDEX IF NOT EXISTS idx_pma_date_range 
ON project_member_allocations(team_member_id, allocated_from, allocated_to);

-- Create index for project queries
CREATE INDEX IF NOT EXISTS idx_pma_project 
ON project_member_allocations(project_id, allocated_from);
```

### 1.2 Create Allocation History Table

```sql
CREATE TABLE IF NOT EXISTS project_member_allocation_history (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    allocation_id       UUID NOT NULL,
    project_id          UUID NOT NULL REFERENCES projects(id),
    team_member_id      UUID NOT NULL REFERENCES team_members(id),
    old_allocated_from  DATE,
    old_allocated_to    DATE,
    old_seconds_per_day INTEGER,
    new_allocated_from  DATE,
    new_allocated_to    DATE,
    new_seconds_per_day INTEGER,
    changed_by          UUID REFERENCES users(id),
    changed_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    change_reason       TEXT
);

CREATE INDEX idx_pmah_allocation ON project_member_allocation_history(allocation_id);
CREATE INDEX idx_pmah_member ON project_member_allocation_history(team_member_id);
```

### 1.3 Create Capacity Calculation Function

```sql
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
    is_weekend BOOLEAN
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
            COALESCE(SUM(pma.seconds_per_day) / 3600.0, 0) AS allocated_hours
        FROM date_series ds
        LEFT JOIN project_member_allocations pma 
            ON pma.team_member_id = p_team_member_id
            AND ds.date BETWEEN pma.allocated_from AND pma.allocated_to
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
    )
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
        GREATEST(0, 
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
            END - da.allocated_hours
        ) AS available_hours,
        CASE 
            WHEN os.hours_per_day > 0 THEN 
                ROUND((da.allocated_hours / os.hours_per_day) * 100, 2)
            ELSE 0
        END AS utilization_percent,
        toc.is_time_off,
        FALSE AS is_holiday,  -- TODO: Integrate with organization_holidays
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
    ORDER BY ds.date;
END;
$$ LANGUAGE plpgsql;
```

