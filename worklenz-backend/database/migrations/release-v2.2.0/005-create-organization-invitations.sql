-- Create organization_invitations table for organization-level client portal invites
-- This allows organizations to generate a single invite link that any client can use to join

-- Create organization_invitations table
CREATE TABLE IF NOT EXISTS organization_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    usage_count INTEGER DEFAULT 0,
    max_usage INTEGER DEFAULT NULL, -- NULL means unlimited usage
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one active invitation per team
    CONSTRAINT unique_team_invitation UNIQUE (team_id)
);

-- Create indexes for organization_invitations table
CREATE INDEX IF NOT EXISTS idx_organization_invitations_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_team_id ON organization_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_status ON organization_invitations(status);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_expires_at ON organization_invitations(expires_at);

-- Add comments for documentation
COMMENT ON TABLE organization_invitations IS 'Stores organization-level invitation links for client portal access';
COMMENT ON COLUMN organization_invitations.token IS 'Unique token used in the invitation URL';
COMMENT ON COLUMN organization_invitations.usage_count IS 'Number of times this invitation has been used';
COMMENT ON COLUMN organization_invitations.max_usage IS 'Maximum number of times this invitation can be used (NULL = unlimited)';
COMMENT ON COLUMN organization_invitations.status IS 'Status of the invitation: active, expired, or revoked';

-- Create function to clean up expired organization invitations
CREATE OR REPLACE FUNCTION cleanup_expired_organization_invitations()
RETURNS void AS $$
BEGIN
    UPDATE organization_invitations 
    SET status = 'expired', updated_at = NOW()
    WHERE expires_at < NOW() AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_organization_invitations_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organization_invitations_updated_at_trigger
    BEFORE UPDATE ON organization_invitations
    FOR EACH ROW
    EXECUTE FUNCTION update_organization_invitations_updated_at();