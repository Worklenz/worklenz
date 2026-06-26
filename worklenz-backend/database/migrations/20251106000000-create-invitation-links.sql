-- Migration: Create invitation links tables for team and project invitations
-- Date: 2025-02-06
-- Description: Add support for link-based invitations for teams and projects

-- Create team_invitation_links table
CREATE TABLE IF NOT EXISTS team_invitation_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    usage_count INTEGER DEFAULT 0,
    max_usage INTEGER DEFAULT NULL, -- NULL means unlimited usage
    job_title_id UUID REFERENCES job_titles(id) ON DELETE SET NULL,
    role_name VARCHAR(50) DEFAULT 'MEMBER',
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one active invitation per team at a time
    CONSTRAINT unique_active_team_invitation UNIQUE (team_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- Create project_invitation_links table  
CREATE TABLE IF NOT EXISTS project_invitation_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    usage_count INTEGER DEFAULT 0,
    max_usage INTEGER DEFAULT NULL, -- NULL means unlimited usage
    access_level VARCHAR(50) DEFAULT 'MEMBER',
    job_title_id UUID REFERENCES job_titles(id) ON DELETE SET NULL,
    role_name VARCHAR(50) DEFAULT 'MEMBER',
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one active invitation per project at a time
    CONSTRAINT unique_active_project_invitation UNIQUE (project_id, status) DEFERRABLE INITIALLY DEFERRED
);

-- Create invitation_link_usage table to track who used which links
CREATE TABLE IF NOT EXISTS invitation_link_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_invitation_link_id UUID REFERENCES team_invitation_links(id) ON DELETE CASCADE,
    project_invitation_link_id UUID REFERENCES project_invitation_links(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    team_member_id UUID REFERENCES team_members(id) ON DELETE CASCADE,
    project_member_id UUID REFERENCES project_members(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure either team or project invitation link is set, not both
    CONSTRAINT check_invitation_type CHECK (
        (team_invitation_link_id IS NOT NULL AND project_invitation_link_id IS NULL) OR
        (team_invitation_link_id IS NULL AND project_invitation_link_id IS NOT NULL)
    )
);

-- Create indexes for team_invitation_links table
CREATE INDEX IF NOT EXISTS idx_team_invitation_links_token ON team_invitation_links(token);
CREATE INDEX IF NOT EXISTS idx_team_invitation_links_team_id ON team_invitation_links(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitation_links_status ON team_invitation_links(status);
CREATE INDEX IF NOT EXISTS idx_team_invitation_links_expires_at ON team_invitation_links(expires_at);
CREATE INDEX IF NOT EXISTS idx_team_invitation_links_created_by ON team_invitation_links(created_by);

-- Create indexes for project_invitation_links table
CREATE INDEX IF NOT EXISTS idx_project_invitation_links_token ON project_invitation_links(token);
CREATE INDEX IF NOT EXISTS idx_project_invitation_links_project_id ON project_invitation_links(project_id);
CREATE INDEX IF NOT EXISTS idx_project_invitation_links_team_id ON project_invitation_links(team_id);
CREATE INDEX IF NOT EXISTS idx_project_invitation_links_status ON project_invitation_links(status);
CREATE INDEX IF NOT EXISTS idx_project_invitation_links_expires_at ON project_invitation_links(expires_at);
CREATE INDEX IF NOT EXISTS idx_project_invitation_links_created_by ON project_invitation_links(created_by);

-- Create indexes for invitation_link_usage table
CREATE INDEX IF NOT EXISTS idx_invitation_link_usage_team_link ON invitation_link_usage(team_invitation_link_id);
CREATE INDEX IF NOT EXISTS idx_invitation_link_usage_project_link ON invitation_link_usage(project_invitation_link_id);
CREATE INDEX IF NOT EXISTS idx_invitation_link_usage_user_id ON invitation_link_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_invitation_link_usage_email ON invitation_link_usage(email);
CREATE INDEX IF NOT EXISTS idx_invitation_link_usage_used_at ON invitation_link_usage(used_at);

-- Add comments for documentation
COMMENT ON TABLE team_invitation_links IS 'Stores team-level invitation links for joining teams via shareable links';
COMMENT ON COLUMN team_invitation_links.token IS 'Unique token used in the invitation URL';
COMMENT ON COLUMN team_invitation_links.usage_count IS 'Number of times this invitation has been used';
COMMENT ON COLUMN team_invitation_links.max_usage IS 'Maximum number of times this invitation can be used (NULL = unlimited)';
COMMENT ON COLUMN team_invitation_links.status IS 'Status of the invitation: active, expired, or revoked';
COMMENT ON COLUMN team_invitation_links.role_name IS 'Default role to assign to users joining via this link';

COMMENT ON TABLE project_invitation_links IS 'Stores project-level invitation links for joining projects via shareable links';
COMMENT ON COLUMN project_invitation_links.token IS 'Unique token used in the invitation URL';
COMMENT ON COLUMN project_invitation_links.usage_count IS 'Number of times this invitation has been used';
COMMENT ON COLUMN project_invitation_links.max_usage IS 'Maximum number of times this invitation can be used (NULL = unlimited)';
COMMENT ON COLUMN project_invitation_links.status IS 'Status of the invitation: active, expired, or revoked';
COMMENT ON COLUMN project_invitation_links.access_level IS 'Project access level for users joining via this link';

COMMENT ON TABLE invitation_link_usage IS 'Tracks usage of invitation links including user details and metadata';

-- Create function to clean up expired invitation links
CREATE OR REPLACE FUNCTION cleanup_expired_invitation_links()
RETURNS void AS $$
BEGIN
    -- Update expired team invitation links
    UPDATE team_invitation_links 
    SET status = 'expired', updated_at = NOW()
    WHERE expires_at < NOW() AND status = 'active';
    
    -- Update expired project invitation links
    UPDATE project_invitation_links 
    SET status = 'expired', updated_at = NOW()
    WHERE expires_at < NOW() AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Create function to revoke existing active invitations when creating new ones
CREATE OR REPLACE FUNCTION revoke_existing_team_invitations()
RETURNS trigger AS $$
BEGIN
    -- Revoke any existing active invitations for the same team
    UPDATE team_invitation_links 
    SET status = 'revoked', updated_at = NOW()
    WHERE team_id = NEW.team_id AND status = 'active' AND id != NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION revoke_existing_project_invitations()
RETURNS trigger AS $$
BEGIN
    -- Revoke any existing active invitations for the same project
    UPDATE project_invitation_links 
    SET status = 'revoked', updated_at = NOW()
    WHERE project_id = NEW.project_id AND status = 'active' AND id != NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_invitation_links_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for team invitation links
CREATE TRIGGER team_invitation_links_updated_at_trigger
    BEFORE UPDATE ON team_invitation_links
    FOR EACH ROW
    EXECUTE FUNCTION update_invitation_links_updated_at();

CREATE TRIGGER team_invitation_links_revoke_existing_trigger
    AFTER INSERT ON team_invitation_links
    FOR EACH ROW
    WHEN (NEW.status = 'active')
    EXECUTE FUNCTION revoke_existing_team_invitations();

-- Create triggers for project invitation links
CREATE TRIGGER project_invitation_links_updated_at_trigger
    BEFORE UPDATE ON project_invitation_links
    FOR EACH ROW
    EXECUTE FUNCTION update_invitation_links_updated_at();

CREATE TRIGGER project_invitation_links_revoke_existing_trigger
    AFTER INSERT ON project_invitation_links
    FOR EACH ROW
    WHEN (NEW.status = 'active')
    EXECUTE FUNCTION revoke_existing_project_invitations();

-- Create function to increment usage count when invitation is used
CREATE OR REPLACE FUNCTION increment_invitation_usage()
RETURNS trigger AS $$
BEGIN
    -- Increment usage count for team invitation links
    IF NEW.team_invitation_link_id IS NOT NULL THEN
        UPDATE team_invitation_links 
        SET usage_count = usage_count + 1, updated_at = NOW()
        WHERE id = NEW.team_invitation_link_id;
        
        -- Check if max usage is reached and revoke if necessary
        UPDATE team_invitation_links 
        SET status = 'expired', updated_at = NOW()
        WHERE id = NEW.team_invitation_link_id 
        AND max_usage IS NOT NULL 
        AND usage_count >= max_usage;
    END IF;
    
    -- Increment usage count for project invitation links
    IF NEW.project_invitation_link_id IS NOT NULL THEN
        UPDATE project_invitation_links 
        SET usage_count = usage_count + 1, updated_at = NOW()
        WHERE id = NEW.project_invitation_link_id;
        
        -- Check if max usage is reached and revoke if necessary
        UPDATE project_invitation_links 
        SET status = 'expired', updated_at = NOW()
        WHERE id = NEW.project_invitation_link_id 
        AND max_usage IS NOT NULL 
        AND usage_count >= max_usage;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to increment usage count
CREATE TRIGGER invitation_link_usage_increment_trigger
    AFTER INSERT ON invitation_link_usage
    FOR EACH ROW
    EXECUTE FUNCTION increment_invitation_usage();

-- Create function to validate invitation link before use
CREATE OR REPLACE FUNCTION validate_invitation_link(
    p_token TEXT,
    p_link_type TEXT -- 'team' or 'project'
)
RETURNS TABLE (
    is_valid BOOLEAN,
    link_id UUID,
    team_id UUID,
    project_id UUID,
    expires_at TIMESTAMP WITH TIME ZONE,
    max_usage INTEGER,
    usage_count INTEGER,
    job_title_id UUID,
    role_name VARCHAR(50),
    is_admin BOOLEAN,
    access_level VARCHAR(50),
    error_message TEXT
) AS $$
BEGIN
    IF p_link_type = 'team' THEN
        RETURN QUERY
        SELECT 
            CASE 
                WHEN til.id IS NULL THEN FALSE
                WHEN til.status != 'active' THEN FALSE
                WHEN til.expires_at < NOW() THEN FALSE
                WHEN til.max_usage IS NOT NULL AND til.usage_count >= til.max_usage THEN FALSE
                ELSE TRUE
            END as is_valid,
            til.id as link_id,
            til.team_id,
            NULL::UUID as project_id,
            til.expires_at,
            til.max_usage,
            til.usage_count,
            til.job_title_id,
            til.role_name,
            til.is_admin,
            NULL::VARCHAR(50) as access_level,
            CASE 
                WHEN til.id IS NULL THEN 'Invalid invitation link'
                WHEN til.status != 'active' THEN 'Invitation link is no longer active'
                WHEN til.expires_at < NOW() THEN 'Invitation link has expired'
                WHEN til.max_usage IS NOT NULL AND til.usage_count >= til.max_usage THEN 'Invitation link usage limit reached'
                ELSE NULL
            END as error_message
        FROM team_invitation_links til
        WHERE til.token = p_token;
        
    ELSIF p_link_type = 'project' THEN
        RETURN QUERY
        SELECT 
            CASE 
                WHEN pil.id IS NULL THEN FALSE
                WHEN pil.status != 'active' THEN FALSE
                WHEN pil.expires_at < NOW() THEN FALSE
                WHEN pil.max_usage IS NOT NULL AND pil.usage_count >= pil.max_usage THEN FALSE
                ELSE TRUE
            END as is_valid,
            pil.id as link_id,
            pil.team_id,
            pil.project_id,
            pil.expires_at,
            pil.max_usage,
            pil.usage_count,
            pil.job_title_id,
            pil.role_name,
            pil.is_admin,
            pil.access_level,
            CASE 
                WHEN pil.id IS NULL THEN 'Invalid invitation link'
                WHEN pil.status != 'active' THEN 'Invitation link is no longer active'
                WHEN pil.expires_at < NOW() THEN 'Invitation link has expired'
                WHEN pil.max_usage IS NOT NULL AND pil.usage_count >= pil.max_usage THEN 'Invitation link usage limit reached'
                ELSE NULL
            END as error_message
        FROM project_invitation_links pil
        WHERE pil.token = p_token;
    ELSE
        RETURN QUERY
        SELECT 
            FALSE as is_valid,
            NULL::UUID as link_id,
            NULL::UUID as team_id,
            NULL::UUID as project_id,
            NULL::TIMESTAMP WITH TIME ZONE as expires_at,
            NULL::INTEGER as max_usage,
            NULL::INTEGER as usage_count,
            NULL::UUID as job_title_id,
            NULL::VARCHAR(50) as role_name,
            NULL::BOOLEAN as is_admin,
            NULL::VARCHAR(50) as access_level,
            'Invalid link type' as error_message;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Migration: Fix invitation links unique constraints
-- Date: 2025-11-06
-- Description: Fix unique constraints to only apply to active invitations, allowing multiple revoked/expired invitations

-- Drop the existing constraints that are too restrictive
ALTER TABLE team_invitation_links DROP CONSTRAINT IF EXISTS unique_active_team_invitation;
ALTER TABLE project_invitation_links DROP CONSTRAINT IF EXISTS unique_active_project_invitation;

-- Create partial unique indexes that only apply to 'active' status
-- This allows multiple 'revoked' or 'expired' invitations but only one 'active' per team/project
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_team_invitation_idx 
ON team_invitation_links (team_id) 
WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_project_invitation_idx 
ON project_invitation_links (project_id) 
WHERE status = 'active';

-- Add comments to explain the constraint logic
COMMENT ON INDEX unique_active_team_invitation_idx IS 'Ensures only one active invitation link per team at a time, allows multiple revoked/expired invitations';
COMMENT ON INDEX unique_active_project_invitation_idx IS 'Ensures only one active invitation link per project at a time, allows multiple revoked/expired invitations';