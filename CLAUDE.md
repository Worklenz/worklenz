# PPM TaskFlow — Worklenz Fork for PPM Agency

## What This Is
Soft fork of [Worklenz](https://github.com/Worklenz/worklenz) for PPM's project management + client portal. Replaces Monday.com ($450/month) with self-hosted solution that adds 3-layer visibility (Master → Internal → Client) and automated feedback routing.

## Ecosystem Context
Part of the PPM Automation Tool Ecosystem:
- **CreativeHQ** — Ad creative pipeline (live at app.creativehq.ai)
- **Data Warehouse** — Analytics data owner (in progress)
- **PPM TaskFlow** (this repo) — Project management + client hub
- **PPM Brain** — AI agent orchestration
- Design spec: `~/conductor/workspaces/ppm-automation-tool-ecosystem-v1/beirut/docs/client-hub-design.md`
- Test plan: `~/conductor/workspaces/ppm-automation-tool-ecosystem-v1/beirut/docs/client-hub-test-plan.md`

## Fork Strategy — Soft Fork Rules

ALL PPM customizations follow these conventions to keep upstream merges feasible:

**Database:**
- New tables: `ppm_` prefix (e.g., `ppm_deliverables`, `ppm_clients`, `ppm_client_users`)
- NEVER modify existing Worklenz tables — create `ppm_` extension tables with FK
- New migrations: `worklenz-backend/database/migrations/ppm/`
- New functions: `ppm_` prefix

**Backend:**
- New routes/controllers: `worklenz-backend/src/ppm/`
- New middleware: `worklenz-backend/src/ppm/middleware/`
- Modified Worklenz code (AVOID): use `// PPM-OVERRIDE: [reason]` pattern

**Frontend:**
- New components: `worklenz-frontend/src/components/ppm/` or `worklenz-frontend/src/app/ppm/`
- Theme overrides: `worklenz-frontend/src/app/ppm/theme/`
- Modified components: same PPM-OVERRIDE pattern

**Config:**
- PPM env vars: `PPM_` prefix

## Tech Stack (Worklenz Core)
- **Backend:** Express.js (TypeScript), PostgreSQL (node-pg), Passport.js (local + Google OAuth), Socket.IO
- **Frontend:** React 18 (TypeScript), Vite, Redux Toolkit, Ant Design
- **Sessions:** express-session + connect-pg-simple (stored in PostgreSQL `pg_sessions` table)
- **Real-time:** Socket.IO for live updates (task changes, timer sync)

## Key Paths
- Backend entry: `worklenz-backend/src/app.ts`
- API routes: `worklenz-backend/src/routes/apis/` (all behind `isLoggedIn` middleware)
- Database schema: `worklenz-backend/database/sql/1_tables.sql`
- Migrations: `worklenz-backend/database/migrations/`
- Passport config: `worklenz-backend/src/passport/`
- Frontend components: `worklenz-frontend/src/components/`
- Redux slices: `worklenz-frontend/src/features/`
- API services: `worklenz-frontend/src/api/`

## Key Tables (Worklenz Core)
- `tasks` — id, name, project_id, status_id, start_date, end_date, total_minutes
- `task_work_log` — time_spent (seconds), task_id, user_id, logged_by_timer
- `task_timers` — task_id, user_id, start_time (running timers)
- `projects` — id, name, team_id, owner_id
- `users` — id, name, email, password, active_team
- `teams` — id, name, user_id

## Time Tracking Notes
- Time stored as seconds in `task_work_log.time_spent` (NUMERIC type)
- Timer-based (Socket.IO start/stop events) and manual log entry both supported
- No built-in increment enforcement — PPM needs 15-min (900s) increment validation
- Frontend hooks: `useTaskTimer.ts`, `useTaskTimerWithConflictCheck.ts`
- Backend controller: `worklenz-backend/src/controllers/task-work-log-controller.ts`

## Current Phase: Kill-Shot Spike (Phase 1)
Proving core assumptions before full build:
1. ~~Fork + clone~~ DONE
2. RLS row-level security for client isolation
3. LISTEN/NOTIFY for real-time routing
4. Magic link auth for client portal
5. API-writable tasks (PPMBot integration path)
6. Time tracking 15-min increment support

## AGPL-3.0 License
This repo must remain public on GitHub per AGPL source disclosure requirements.
