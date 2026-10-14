# GitHub Integration: Implementation Checklist

Branch: `feat/github-integration`. Spec: `Feature Specification: GitHub.md`.
Legend: `[x]` done, `[ ]` pending, `[~]` in progress.

## Phase 1: Connection, mapping, ingest, Development panel

### Backend
- [x] Migration: `github_*` tables (integrations, repositories, project repos, user links, branches, PRs, commits, task links, issue links, webhook events)
- [x] Issue key parser (scoped to linked project keys) + unit tests
- [x] Webhook signature verification (raw body, constant time) + unit tests
- [x] GitHub App service (JWT, installation token cache, API client with backoff)
- [x] Webhook receiver route `/webhook/github` (outside session/CSRF) + enqueue idempotent by delivery id
- [x] Event processor (push, create/delete, pull_request, pull_request_review, installation, installation_repositories)
- [x] Background worker (`SKIP LOCKED`, retries, stale recovery) wired in `app.ts`
- [x] Team API: status, install-url, callback, disconnect, list repositories
- [x] Project API: list/link/update/unlink repositories (software projects only, admin/PM)
- [x] Task API: development info (branches, PRs, commits)
- [x] Software-project access guard (no separate plan gate)
- [x] Env vars documented in `.env.template`

### Frontend
- [x] API service + types
- [x] Settings > Integrations: GitHub card (locked / not configured / connect / connected + manage)
- [x] Install popup/redirect handling and status feedback
- [x] Project settings: GitHub repositories section (link, configure, unlink)
- [x] Project settings Integrations section: GitHub shown for software projects (the quick-access dropdown still lists GitHub as coming soon; see follow-ups)
- [x] Task drawer: Development panel (branches, PRs, commits) with loading/empty/error states
- [x] i18n: `en` plus all other locales, with `defaultValue`
- [x] Light/dark theme, responsive, a11y checks

### Verification
- [x] Backend unit tests pass (parser, signature)
- [x] Frontend tests pass (Development panel + existing info-tab suites)
- [x] Type check passes (backend clean; frontend has one pre-existing unrelated error: `IFileUploadState` import)
- [x] Migration applies and reverts cleanly
- [ ] Manual smoke test with a dev GitHub App (needs user's App credentials)

## Phase 2: Automation
- [x] Per-repo status mapping (stored in `settings.status_map`, defaults derived from status categories on link)
- [x] Transition rules: forward-only, never reopens done, state-reconciling across all linked PRs/branches (+ unit tests)
- [x] Automated transitions via the same DB function as manual status changes (progress, completed_at, activity log, project room emit)
- [x] Dependency check before moving to a done status
- [x] `GITHUB_TASK_ACTIVITY` socket event; drawer refreshes live
- [x] Create Branch API + modal (validated name, base SHA lookup, links branch, copyable checkout command)
- [x] Project settings UI: status automation selects per linked repository
- [x] i18n for all locales
- [ ] GitHub identity link for members (OAuth user flow). Until built, the actor for automated changes is the PR author when a link exists, otherwise the user who linked the repository
- [ ] Task activity log text mentions the PR (log currently shows the standard status change attributed to the actor)
- [ ] Notifications to assignees on automated transitions (deliberately skipped to avoid noise; decide)
- [ ] Event processor / automation integration tests against a DB fixture

## Phase 3: Issue import (not started)
- [ ] Import modal and one-way import
- [ ] Auto-import by label filter
- [ ] Team sync-status view with retry

## Phase 4 (not started)
- [ ] Push-back, milestone/release sync, admin metrics

## Follow-ups noticed during Phase 1
- [x] Project integrations quick dropdown: GitHub enabled for software projects (opens project settings > Integrations); button no longer Business-gated on software projects, Slack shows locked inside
- [ ] Add `GITHUB_*` vars to docker env templates / SELF_HOSTING.md
- [ ] Real-time socket push so the drawer refreshes when a webhook lands (Phase 2 with transitions)
- [ ] Backend tests for event processor and controller (need DB fixture)
- [x] Connect GitHub inline from project settings (install returns to the project's Integrations section; non-admins see who to ask)
