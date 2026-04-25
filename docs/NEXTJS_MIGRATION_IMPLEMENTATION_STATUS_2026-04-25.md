# Next.js Migration Implementation Status

Date: 2026-04-25

## Completed in this iteration

1. Added a new Next.js App Router application at `worklenz-next/`.
2. Wired Clerk middleware and auth routes (`/sign-in`, `/sign-up`) with protected app routing.
3. Migrated core route structure from React Router to Next.js pages:
   - `/worklenz/home`
   - `/worklenz/projects`
   - `/worklenz/projects/[projectId]`
   - `/worklenz/schedule`
   - `/worklenz/unauthorized`
   - `/worklenz/gantt-demo`
4. Added Prisma schema and runtime client for Supabase Postgres.
5. Added Cloudflare R2 signed upload/download URL helpers.
6. Added Upstash Redis client helper.
7. Added Supabase SSR and realtime subscription utility.
8. Added Resend + React Email template setup.
9. Added Axiom structured logging utility.
10. Added secure Vercel cron endpoints and `vercel.json` schedule config.
11. Added Prisma + Upstash + Axiom-backed task API route handlers in Next.js (`GET/POST /api/projects/[projectId]/tasks`).
12. Added Supabase Realtime broadcast route (`POST /api/realtime/broadcast`) as Socket.IO replacement entrypoint.
13. Replaced Docker stack with Next.js-focused compose setup.
14. Removed database backup service from compose per requirement.
15. Removed nginx and certbot from compose per requirement.
16. Ported attendance module to Next.js (`GET/POST /api/attendance`) with auto-check-in confirmation model.
17. Ported office management module to Next.js (`GET/POST /api/offices`, `PATCH /api/offices/[id]`).
18. Ported task query log workflows (`GET/POST /api/tasks/[taskId]/query-logs`, `POST /api/tasks/query-logs/[id]/respond`).
19. Ported JCC review workflows:
    - `GET /api/jcc/review-queue`
    - `POST /api/jcc/tasks/[taskId]/submit` (mandatory time-log enforcement)
    - `POST /api/jcc/tasks/[taskId]/review` (approve/reject/revision/on-hold with validations)
20. Added realtime publishing for review and submit actions using Supabase broadcast channels.
21. Added app routes for Attendance and Review Queue in the Next.js layout.
22. Expanded Prisma schema for office, attendance, query log, and review metadata fields.
23. Added additional Vercel cron endpoints for project digest and recurring tasks.

## Remaining for production parity

1. Port remaining Vite UI modules from `worklenz-frontend` into `worklenz-next` (Kanban, task drawer, dashboard widgets).
2. Replace remaining backend API surfaces with Next.js route handlers using Prisma.
3. Finalize Socket.IO removal by moving all frontend listeners/actions to Supabase Realtime channels.
4. Implement full cron business logic in `app/api/cron/*` (currently scaffolds with logging).
5. Complete SES to Resend migration for all email templates and notification events.
6. Replace legacy file-log and logger middleware usage across all migrated handlers with Axiom.
7. Apply Prisma baseline against existing production schema and run staged data validation.
8. Finalize Clerk role synchronization and authorization policies for MD/Senior QS/QS.
9. Add E2E and integration tests for auth, review flow, attendance, realtime, email, and cron.
10. Configure and validate production env on Vercel/Supabase/R2/Upstash/Clerk/Resend/Axiom.
