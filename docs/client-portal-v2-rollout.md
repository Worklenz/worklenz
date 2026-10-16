# Client Portal v2: rollout and rollback

Applies to the Client Portal v2 release (admin console, client portal app, v2 API and schema). Nothing here is run by CI.

## Before you start

- Take a full database backup and confirm it restores.
- Set `JWT_SECRET` on the backend. The server now refuses to start without it, and there is no fallback value. Optionally set `CLIENT_SIGN_IN_CODE_SECRET`; otherwise the sign-in code key is derived from `JWT_SECRET`.
- Set `CLIENT_PORTAL_ALLOWED_ORIGINS` (comma separated) for every browser origin that calls the client portal API besides `CLIENT_PORTAL_URL` and `FRONTEND_URL`. **The hostnames that used to be hardcoded are gone**, so the ones each environment still needs must be listed here or in `CLIENT_PORTAL_URL`, otherwise state-changing client requests from them are refused with 403. The previously hardcoded set was `https://clients.worklenz.com`, `https://wl-client.ceydigital.dev` and `http(s)://dev.worklenz.com`. Local dev servers (`localhost:5173/5174/3000`) are allowed automatically unless `NODE_ENV=production`.
- Migrations that create or replace functions need the schema owner: set the `MIGRATION_DB_*` credentials.
- On environments whose `pgmigrations` table is empty or unreliable, compare the live schema first and follow the approved bootstrap process; do not edit `pgmigrations` by hand.

## Order

1. Run the migrations (`npm run migrate:up` in `worklenz-backend`). About 30 files from `1791298000000` to `1791798944695`, all with `down`.
2. Deploy the backend.
3. Deploy the admin console (`worklenz-frontend`).
4. Deploy the client portal app (`worklenz-client-portal`).

The v1 admin screens and the old password sign-in answer 410 after step 2, so a stale client app shows a clear message instead of failing silently.

## Rollback

- Application: redeploy the previous backend and apps. The old backend ignores the new tables and columns.
- Schema: `npm run migrate:down -- <count>` steps back in reverse order. Each `down` drops what its `up` added. Data written to the new tables (approvals, change requests, discussions, audit events, layouts, sign-in codes) is lost on `down`, so restore from the backup if that data matters.
- Do not roll back the schema while the new backend is still running.
- Rolling back `1791298000000` turns every Client Viewer into a Client Member (v1 has no read-only role), which gives them comment, upload and change-request rights. Before running it, list the viewers (`SELECT id, email FROM client_contacts WHERE role = 'viewer'`) and deactivate any that must stay read-only.
- Removing or deactivating the only named approver of a waiting approval now asks staff to confirm (API: `confirm_pending_approvals`).

## Sharing rules to know about

- **File versions.** Sharing a file shares the version that was current at that moment and later ones (`project_files.first_shared_version`). Earlier versions stay Internal Only. Migration `1791798944695` backfills files staff already shared to their current version, so internal drafts uploaded before the share stop being downloadable by clients. Files a client uploaded start at version 1. Returning a file to Internal Only clears the value; sharing it again starts from the then-current version.
- **Staff message attachments.** Attaching a file to a client-visible message shares only the attached (current) version, not the file's earlier drafts. The composer says so.
- **Change requests.** A Client Admin sees every change request (and its discussion) of their client. A Member or Viewer sees only the requests they submitted, including the estimate cost.

## Smoke test after deploy

- Request and verify a sign-in code for a client contact; five wrong codes retire it.
- A named approver whose project access is removed gets 404 on the decision.
- A client upload of an `.html` or `.svg` file is refused; a PDF succeeds and only its uploader can confirm it.
