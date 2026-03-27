-- PPM Migration 013: Phase 2 tables
--
-- New tables: ppm_internal_users, ppm_client_partners, ppm_client_projects,
--             ppm_comments, ppm_status_mapping
-- Alters: ppm_deliverables (add 'incoming' to status CHECK),
--         ppm_clients (drop primary_partner_id — use ppm_client_partners instead)
--
-- Architecture decisions: see .context/phase2-engineering-plan.md

BEGIN;

-- ============================================================
-- 1. ppm_internal_users — partner vs employee role per Worklenz user
--    Soft-fork: extends users table without modifying it
-- ============================================================

CREATE TABLE IF NOT EXISTS ppm_internal_users (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ppm_role   TEXT        NOT NULL CHECK (ppm_role IN ('partner', 'employee')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ppm_internal_users_role ON ppm_internal_users (ppm_role);

COMMENT ON TABLE ppm_internal_users IS 'PPM role assignments for internal Worklenz users. Partners see master layer; employees see assigned work only.';

-- ============================================================
-- 2. ppm_client_partners — many-to-many client↔partner with role
--    Replaces ppm_clients.primary_partner_id (single source of truth)
-- ============================================================

CREATE TABLE IF NOT EXISTS ppm_client_partners (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id  UUID        NOT NULL REFERENCES ppm_clients(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       TEXT        NOT NULL CHECK (role IN ('primary', 'creative', 'paid_media', 'retention')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(client_id, user_id, role)
);

CREATE INDEX idx_ppm_client_partners_client ON ppm_client_partners (client_id);
CREATE INDEX idx_ppm_client_partners_user   ON ppm_client_partners (user_id);

COMMENT ON TABLE ppm_client_partners IS 'PPM partner assignments per client. One partner can have multiple roles per client.';

-- ============================================================
-- 3. ppm_client_projects — client↔project junction (1:many)
--    Stores incoming_status_id so portal task creation uses a stored UUID,
--    never looks up by name.
-- ============================================================

CREATE TABLE IF NOT EXISTS ppm_client_projects (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id           UUID        NOT NULL REFERENCES ppm_clients(id) ON DELETE CASCADE,
    project_id          UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    is_primary          BOOLEAN     NOT NULL DEFAULT false,
    incoming_status_id  UUID        REFERENCES task_statuses(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(client_id, project_id)
);

-- Only one primary project per client
CREATE UNIQUE INDEX ppm_client_projects_one_primary
    ON ppm_client_projects (client_id) WHERE is_primary = true;

CREATE INDEX idx_ppm_client_projects_project ON ppm_client_projects (project_id);

COMMENT ON TABLE ppm_client_projects IS 'Links PPM clients to Worklenz projects. One client can have multiple projects; exactly one is primary (portal submissions go there).';

-- ============================================================
-- 4. ppm_comments — dedicated comments table
--    Replaces Phase 1 audit_log-based comments. Supports author_type
--    for role color-coding (partner=purple, client=blue, employee=green).
-- ============================================================

CREATE TABLE IF NOT EXISTS ppm_comments (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id       UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    deliverable_id UUID       REFERENCES ppm_deliverables(id) ON DELETE SET NULL,
    author_id     UUID        NOT NULL,
    author_type   TEXT        NOT NULL CHECK (author_type IN ('partner', 'employee', 'client')),
    author_name   TEXT        NOT NULL,
    body          TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ppm_comments_task ON ppm_comments (task_id, created_at);
CREATE INDEX idx_ppm_comments_deliverable ON ppm_comments (deliverable_id)
    WHERE deliverable_id IS NOT NULL;

COMMENT ON TABLE ppm_comments IS 'PPM task comments with author type tracking for role-based display.';

-- ============================================================
-- 5. ppm_status_mapping — ID-based status mapping
--    Maps (project_id, task_status_id) → ppm_status enum.
--    Used by sync trigger instead of fragile name-based CASE matching.
-- ============================================================

CREATE TABLE IF NOT EXISTS ppm_status_mapping (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    task_status_id  UUID NOT NULL REFERENCES task_statuses(id) ON DELETE CASCADE,
    ppm_status      TEXT NOT NULL CHECK (ppm_status IN (
        'incoming', 'queued', 'in_progress', 'internal_review',
        'client_review', 'revision', 'approved', 'done'
    )),
    UNIQUE(project_id, task_status_id)
);

CREATE INDEX idx_ppm_status_mapping_project ON ppm_status_mapping (project_id);

COMMENT ON TABLE ppm_status_mapping IS 'Maps Worklenz task_statuses to PPM status enum per project. Populated when PPM statuses are seeded.';

-- ============================================================
-- 6. ALTER ppm_deliverables — add 'incoming' to status CHECK
-- ============================================================

-- Drop the old CHECK and recreate with 'incoming' added
ALTER TABLE ppm_deliverables DROP CONSTRAINT IF EXISTS ppm_deliverables_status_check;
ALTER TABLE ppm_deliverables ADD CONSTRAINT ppm_deliverables_status_check
    CHECK (status IN ('incoming', 'queued', 'in_progress', 'internal_review',
                      'client_review', 'revision', 'approved', 'done'));

-- ============================================================
-- 7. DROP primary_partner_id from ppm_clients
--    Single source of truth is now ppm_client_partners WHERE role='primary'
-- ============================================================

ALTER TABLE ppm_clients DROP COLUMN IF EXISTS primary_partner_id;
DROP INDEX IF EXISTS idx_ppm_clients_primary_partner;

COMMIT;
