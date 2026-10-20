'use strict';

/**
 * Migration: GitHub integration for Software projects
 * Date: 2026-10-14
 * Description: Team-level GitHub App installation, repository links per project,
 *              stored Git activity (branches, PRs, commits), task links and the
 *              webhook event queue.
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- One GitHub App installation per team
    CREATE TABLE IF NOT EXISTS github_integrations (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_id         UUID NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
      installation_id BIGINT NOT NULL,
      account_login   TEXT NOT NULL,
      account_type    TEXT NOT NULL DEFAULT 'Organization',
      account_avatar_url TEXT,
      status          TEXT NOT NULL DEFAULT 'active',
      connected_by    UUID REFERENCES users (id) ON DELETE SET NULL,
      connected_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT github_integrations_status_check
        CHECK (status IN ('active', 'suspended', 'disconnected'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS github_integrations_team_unique
      ON github_integrations (team_id) WHERE status <> 'disconnected';
    CREATE UNIQUE INDEX IF NOT EXISTS github_integrations_installation_unique
      ON github_integrations (installation_id) WHERE status <> 'disconnected';

    -- Repositories visible to an installation
    CREATE TABLE IF NOT EXISTS github_repositories (
      id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      integration_id   UUID NOT NULL REFERENCES github_integrations (id) ON DELETE CASCADE,
      github_repo_id   BIGINT NOT NULL,
      full_name        TEXT NOT NULL,
      default_branch   TEXT NOT NULL DEFAULT 'main',
      is_private       BOOLEAN NOT NULL DEFAULT FALSE,
      is_available     BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT github_repositories_unique UNIQUE (integration_id, github_repo_id)
    );

    CREATE INDEX IF NOT EXISTS github_repositories_github_repo_id_index
      ON github_repositories (github_repo_id);

    -- Repository linked to a software project (with per-link settings)
    CREATE TABLE IF NOT EXISTS github_project_repositories (
      id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id     UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
      repository_id  UUID NOT NULL REFERENCES github_repositories (id) ON DELETE CASCADE,
      default_base_branch TEXT,
      settings       JSONB NOT NULL DEFAULT '{}'::JSONB,
      linked_by      UUID REFERENCES users (id) ON DELETE SET NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT github_project_repositories_unique UNIQUE (project_id, repository_id)
    );

    CREATE INDEX IF NOT EXISTS github_project_repositories_repository_index
      ON github_project_repositories (repository_id);

    -- Member to GitHub account link (used for assignee matching later)
    CREATE TABLE IF NOT EXISTS github_user_links (
      id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id        UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      github_user_id BIGINT NOT NULL,
      github_login   TEXT NOT NULL,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT github_user_links_user_unique UNIQUE (user_id),
      CONSTRAINT github_user_links_github_unique UNIQUE (github_user_id)
    );

    -- Stored Git activity
    CREATE TABLE IF NOT EXISTS github_branches (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      repository_id UUID NOT NULL REFERENCES github_repositories (id) ON DELETE CASCADE,
      name          TEXT NOT NULL,
      head_sha      TEXT,
      is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT github_branches_unique UNIQUE (repository_id, name)
    );

    CREATE TABLE IF NOT EXISTS github_pull_requests (
      id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      repository_id  UUID NOT NULL REFERENCES github_repositories (id) ON DELETE CASCADE,
      number         INTEGER NOT NULL,
      title          TEXT NOT NULL,
      body           TEXT,
      state          TEXT NOT NULL DEFAULT 'open',
      is_draft       BOOLEAN NOT NULL DEFAULT FALSE,
      merged         BOOLEAN NOT NULL DEFAULT FALSE,
      review_state   TEXT,
      head_branch    TEXT,
      base_branch    TEXT,
      author_login   TEXT,
      author_avatar_url TEXT,
      html_url       TEXT NOT NULL,
      opened_at      TIMESTAMPTZ,
      merged_at      TIMESTAMPTZ,
      closed_at      TIMESTAMPTZ,
      last_event_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT github_pull_requests_unique UNIQUE (repository_id, number),
      CONSTRAINT github_pull_requests_state_check CHECK (state IN ('open', 'closed')),
      CONSTRAINT github_pull_requests_review_check
        CHECK (review_state IS NULL OR review_state IN ('approved', 'changes_requested', 'review_required'))
    );

    CREATE TABLE IF NOT EXISTS github_commits (
      id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      repository_id  UUID NOT NULL REFERENCES github_repositories (id) ON DELETE CASCADE,
      sha            TEXT NOT NULL,
      message        TEXT NOT NULL,
      author_name    TEXT,
      author_login   TEXT,
      html_url       TEXT,
      committed_at   TIMESTAMPTZ,
      CONSTRAINT github_commits_unique UNIQUE (repository_id, sha)
    );

    -- Many-to-many: task <-> branch / PR / commit
    CREATE TABLE IF NOT EXISTS github_task_links (
      id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      task_id     UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
      link_type   TEXT NOT NULL,
      branch_id   UUID REFERENCES github_branches (id) ON DELETE CASCADE,
      pull_request_id UUID REFERENCES github_pull_requests (id) ON DELETE CASCADE,
      commit_id   UUID REFERENCES github_commits (id) ON DELETE CASCADE,
      closes      BOOLEAN NOT NULL DEFAULT FALSE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT github_task_links_type_check CHECK (link_type IN ('branch', 'pull_request', 'commit')),
      CONSTRAINT github_task_links_target_check CHECK (
        (link_type = 'branch' AND branch_id IS NOT NULL) OR
        (link_type = 'pull_request' AND pull_request_id IS NOT NULL) OR
        (link_type = 'commit' AND commit_id IS NOT NULL)
      )
    );

    CREATE UNIQUE INDEX IF NOT EXISTS github_task_links_branch_unique
      ON github_task_links (task_id, branch_id) WHERE branch_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS github_task_links_pr_unique
      ON github_task_links (task_id, pull_request_id) WHERE pull_request_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS github_task_links_commit_unique
      ON github_task_links (task_id, commit_id) WHERE commit_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS github_task_links_task_index
      ON github_task_links (task_id);

    -- Linked GitHub issue (used by import in a later phase)
    CREATE TABLE IF NOT EXISTS github_issue_links (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      task_id       UUID NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
      repository_id UUID NOT NULL REFERENCES github_repositories (id) ON DELETE CASCADE,
      issue_number  INTEGER NOT NULL,
      state         TEXT NOT NULL DEFAULT 'open',
      html_url      TEXT NOT NULL,
      last_synced_at TIMESTAMPTZ,
      CONSTRAINT github_issue_links_unique UNIQUE (repository_id, issue_number)
    );

    CREATE INDEX IF NOT EXISTS github_issue_links_task_index
      ON github_issue_links (task_id);

    -- Webhook event queue (idempotent by delivery id)
    CREATE TABLE IF NOT EXISTS github_webhook_events (
      id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      delivery_id   TEXT NOT NULL,
      event_type    TEXT NOT NULL,
      installation_id BIGINT,
      payload       JSONB NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      attempts      INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      received_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processed_at  TIMESTAMPTZ,
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT github_webhook_events_delivery_unique UNIQUE (delivery_id),
      CONSTRAINT github_webhook_events_status_check
        CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'ignored'))
    );

    CREATE INDEX IF NOT EXISTS github_webhook_events_queue_index
      ON github_webhook_events (next_attempt_at, received_at) WHERE status = 'pending';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS github_webhook_events;
    DROP TABLE IF EXISTS github_issue_links;
    DROP TABLE IF EXISTS github_task_links;
    DROP TABLE IF EXISTS github_commits;
    DROP TABLE IF EXISTS github_pull_requests;
    DROP TABLE IF EXISTS github_branches;
    DROP TABLE IF EXISTS github_user_links;
    DROP TABLE IF EXISTS github_project_repositories;
    DROP TABLE IF EXISTS github_repositories;
    DROP TABLE IF EXISTS github_integrations;
  `);
};
