-- Add minimal status column to teams table for performance
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'flagged', 'suspended'));

-- Create separate moderation table for detailed tracking
CREATE TABLE IF NOT EXISTS team_moderation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('flagged', 'suspended', 'restored')),
    reason TEXT,
    moderator_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP, -- For temporary suspensions
    metadata JSONB -- For additional context
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status, created_at);
CREATE INDEX IF NOT EXISTS idx_team_moderation_team_id ON team_moderation(team_id);
CREATE INDEX IF NOT EXISTS idx_team_moderation_status ON team_moderation(status, created_at);

-- Create spam_logs table to track spam detection events
CREATE TABLE IF NOT EXISTS spam_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content_type VARCHAR(50) NOT NULL, -- 'organization_name', 'owner_name', 'invitation'
    original_content TEXT NOT NULL,
    sanitized_content TEXT,
    spam_score INTEGER NOT NULL DEFAULT 0,
    spam_reasons JSONB,
    is_high_risk BOOLEAN DEFAULT FALSE,
    action_taken VARCHAR(50), -- 'blocked', 'flagged', 'allowed'
    created_at TIMESTAMP DEFAULT NOW(),
    ip_address INET
);

-- Create index for spam logs
CREATE INDEX IF NOT EXISTS idx_spam_logs_team_id ON spam_logs(team_id);
CREATE INDEX IF NOT EXISTS idx_spam_logs_created_at ON spam_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_spam_logs_content_type ON spam_logs(content_type);

-- Create rate_limit_log table to track rate limiting events
CREATE TABLE IF NOT EXISTS rate_limit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'invite_attempt', 'org_creation'
    blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for rate limit logs
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_user_id ON rate_limit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_created_at ON rate_limit_log(created_at);

-- Add admin flag to users table if it doesn't exist
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Function to log spam detection
CREATE OR REPLACE FUNCTION log_spam_detection(
    p_team_id UUID,
    p_user_id UUID,
    p_content_type VARCHAR(50),
    p_original_content TEXT,
    p_sanitized_content TEXT,
    p_spam_score INTEGER,
    p_spam_reasons JSONB,
    p_is_high_risk BOOLEAN,
    p_action_taken VARCHAR(50),
    p_ip_address INET
) RETURNS VOID AS $$
BEGIN
    INSERT INTO spam_logs (
        team_id, user_id, content_type, original_content, sanitized_content,
        spam_score, spam_reasons, is_high_risk, action_taken, ip_address
    ) VALUES (
        p_team_id, p_user_id, p_content_type, p_original_content, p_sanitized_content,
        p_spam_score, p_spam_reasons, p_is_high_risk, p_action_taken, p_ip_address
    );
END;
$$ LANGUAGE plpgsql;

-- Function to log rate limiting events
CREATE OR REPLACE FUNCTION log_rate_limit_event(
    p_user_id UUID,
    p_ip_address INET,
    p_action_type VARCHAR(50),
    p_blocked BOOLEAN
) RETURNS VOID AS $$
BEGIN
    INSERT INTO rate_limit_log (user_id, ip_address, action_type, blocked)
    VALUES (p_user_id, p_ip_address, p_action_type, p_blocked);
END;
$$ LANGUAGE plpgsql;

-- Function to get spam statistics for a team
CREATE OR REPLACE FUNCTION get_team_spam_stats(p_team_id UUID)
RETURNS TABLE (
    total_detections BIGINT,
    high_risk_detections BIGINT,
    blocked_actions BIGINT,
    latest_detection TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_detections,
        COUNT(*) FILTER (WHERE is_high_risk = TRUE) as high_risk_detections,
        COUNT(*) FILTER (WHERE action_taken = 'blocked') as blocked_actions,
        MAX(created_at) as latest_detection
    FROM spam_logs 
    WHERE team_id = p_team_id;
END;
$$ LANGUAGE plpgsql;

-- View for easy moderation dashboard
CREATE OR REPLACE VIEW moderation_dashboard AS
SELECT 
    t.id as team_id,
    t.name as organization_name,
    u.name as owner_name,
    u.email as owner_email,
    t.created_at as team_created_at,
    t.status as current_status,
    tm.status as last_moderation_action,
    tm.reason as last_moderation_reason,
    tm.created_at as last_moderation_date,
    tm.expires_at as suspension_expires_at,
    moderator.name as moderator_name,
    (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count,
    (SELECT COUNT(*) FROM spam_logs WHERE team_id = t.id) as spam_detection_count,
    (SELECT COUNT(*) FROM spam_logs WHERE team_id = t.id AND is_high_risk = TRUE) as high_risk_count
FROM teams t
INNER JOIN users u ON t.user_id = u.id
LEFT JOIN team_moderation tm ON t.id = tm.team_id 
    AND tm.created_at = (SELECT MAX(created_at) FROM team_moderation WHERE team_id = t.id)
LEFT JOIN users moderator ON tm.moderator_id = moderator.id
WHERE t.status != 'active' OR EXISTS(
    SELECT 1 FROM spam_logs WHERE team_id = t.id AND created_at > NOW() - INTERVAL '7 days'
);

-- Function to update team status and create moderation records
CREATE OR REPLACE FUNCTION update_team_status(
    p_team_id UUID,
    p_new_status VARCHAR(20),
    p_reason TEXT,
    p_moderator_id UUID DEFAULT NULL,
    p_expires_at TIMESTAMP DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Update team status
    UPDATE teams SET status = p_new_status WHERE id = p_team_id;
    
    -- Insert moderation record
    INSERT INTO team_moderation (team_id, status, reason, moderator_id, expires_at)
    VALUES (p_team_id, p_new_status, p_reason, p_moderator_id, p_expires_at);
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically flag teams with high spam scores
CREATE OR REPLACE FUNCTION auto_flag_spam_teams()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-flag teams if they have high spam scores or multiple violations
    IF NEW.spam_score > 80 OR NEW.is_high_risk = TRUE THEN
        PERFORM update_team_status(
            NEW.team_id,
            'flagged',
            'Auto-flagged: High spam score or high-risk content detected',
            NULL
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check and restore expired suspensions
CREATE OR REPLACE FUNCTION restore_expired_suspensions() RETURNS VOID AS $$
BEGIN
    -- Find teams with expired suspensions
    UPDATE teams 
    SET status = 'active'
    WHERE id IN (
        SELECT DISTINCT tm.team_id 
        FROM team_moderation tm
        WHERE tm.status = 'suspended' 
        AND tm.expires_at IS NOT NULL 
        AND tm.expires_at < NOW()
        AND NOT EXISTS (
            SELECT 1 FROM team_moderation tm2 
            WHERE tm2.team_id = tm.team_id 
            AND tm2.created_at > tm.created_at
        )
    );
    
    -- Log restoration records
    INSERT INTO team_moderation (team_id, status, reason, moderator_id)
    SELECT DISTINCT tm.team_id, 'restored', 'Auto-restored: suspension expired', NULL
    FROM team_moderation tm
    WHERE tm.status = 'suspended' 
    AND tm.expires_at IS NOT NULL 
    AND tm.expires_at < NOW()
    AND NOT EXISTS (
        SELECT 1 FROM team_moderation tm2 
        WHERE tm2.team_id = tm.team_id 
        AND tm2.created_at > tm.created_at
        AND tm2.status = 'restored'
    );
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-flagging
DROP TRIGGER IF EXISTS trigger_auto_flag_spam ON spam_logs;
CREATE TRIGGER trigger_auto_flag_spam
    AFTER INSERT ON spam_logs
    FOR EACH ROW
    EXECUTE FUNCTION auto_flag_spam_teams();