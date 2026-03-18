-- Imports base tables for external/csv imports
-- Direct and CSV flows share these tables

BEGIN;

CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID DEFAULT uuid_generate_v4(),
  provider TEXT NOT NULL,
  flow_type TEXT NOT NULL CHECK (flow_type IN ('direct','csv')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','running','success','failed')),
  current_step INT NOT NULL DEFAULT 0,
  target_project_id UUID NULL,
  target_space_type TEXT NULL,
  target_template TEXT NULL,
  source_reference JSONB NULL,
  created_by UUID NOT NULL,
  stats JSONB DEFAULT '{}'::jsonb,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE import_jobs ADD CONSTRAINT import_jobs_pkey PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS import_hierarchy_mappings (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  source_level TEXT NOT NULL,
  target_level TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_field_mappings (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  source_field TEXT NOT NULL,
  target_field TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  include BOOLEAN NOT NULL DEFAULT TRUE,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_value_mappings (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  source_value TEXT NOT NULL,
  target_worktype TEXT NOT NULL,
  include BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_user_mappings (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  source_user_id TEXT NULL,
  source_email TEXT NULL,
  target_user_id UUID NULL,
  resolution TEXT NOT NULL DEFAULT 'unresolved',
  include BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_attachment_plans (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  filename TEXT NULL,
  content_type TEXT NULL,
  size_bytes BIGINT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  storage_key TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_stage_tasks (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  source_task_id TEXT NULL,
  parent_source_task_id TEXT NULL,
  title TEXT NOT NULL,
  description TEXT NULL,
  status TEXT NULL,
  due_at TIMESTAMPTZ NULL,
  start_at TIMESTAMPTZ NULL,
  worktype TEXT NULL,
  assignee_source_id TEXT NULL,
  attachments_planned BOOLEAN NOT NULL DEFAULT FALSE,
  raw JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS import_logs (
  id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_import_jobs_provider ON import_jobs(provider);
CREATE INDEX IF NOT EXISTS idx_import_hierarchy_job ON import_hierarchy_mappings(job_id);
CREATE INDEX IF NOT EXISTS idx_import_field_job ON import_field_mappings(job_id);
CREATE INDEX IF NOT EXISTS idx_import_value_job ON import_value_mappings(job_id);
CREATE INDEX IF NOT EXISTS idx_import_user_job ON import_user_mappings(job_id);
CREATE INDEX IF NOT EXISTS idx_import_attachment_job ON import_attachment_plans(job_id);
CREATE INDEX IF NOT EXISTS idx_import_stage_task_job ON import_stage_tasks(job_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_job ON import_logs(job_id);

COMMIT;
