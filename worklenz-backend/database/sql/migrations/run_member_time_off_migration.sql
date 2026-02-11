-- =====================================================
-- Migration Runner: member_time_off table
-- =====================================================
-- This script checks if the member_time_off table exists
-- and creates it if needed. Safe to run multiple times.
-- =====================================================

DO $$
BEGIN
    -- Check if table exists
    IF NOT EXISTS (
        SELECT FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'member_time_off'
    ) THEN
        RAISE NOTICE 'Creating member_time_off table...';
        
        -- Create the table
        CREATE TABLE member_time_off (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            start_date TIMESTAMP WITH TIME ZONE NOT NULL,
            end_date TIMESTAMP WITH TIME ZONE NOT NULL,
            reason TEXT,
            created_by UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            
            CONSTRAINT valid_time_off_date_range CHECK (end_date >= start_date)
        );
        
        -- Create indexes
        CREATE INDEX idx_member_time_off_dates 
            ON member_time_off(team_member_id, start_date, end_date);
        
        CREATE INDEX idx_member_time_off_org 
            ON member_time_off(organization_id);
        
        -- Add comments
        COMMENT ON TABLE member_time_off IS 'Stores time-off periods for team members to track availability in schedule timeline';
        COMMENT ON COLUMN member_time_off.reason IS 'Optional reason for time-off (vacation, sick leave, etc.)';
        
        RAISE NOTICE 'member_time_off table created successfully!';
    ELSE
        RAISE NOTICE 'member_time_off table already exists. Skipping creation.';
    END IF;
END $$;

-- Verify the table was created
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT FROM pg_tables 
            WHERE schemaname = 'public' 
            AND tablename = 'member_time_off'
        ) 
        THEN '✓ member_time_off table exists'
        ELSE '✗ member_time_off table NOT found'
    END AS status;
