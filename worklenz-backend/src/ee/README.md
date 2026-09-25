# `ee/` — Extended features

Everything in this directory is licensed under the [GNU Affero General Public License Version 3 (AGPLv3)](../../../LICENSE) like the rest of `worklenz-backend/`.

## What's here

- `controllers/`, `routes/apis/` — client portal backend, project finance & rate cards, Slack integration, billing/subscriptions
- `middlewares/subscription-middleware.ts` — `hasBusinessPlanAccess()` / `requireBusinessPlan`, the server-side plan check that gated routes call before allowing extended actions
- `shared/paddle-utils.ts`, `shared/paddle-requests.ts` — Paddle billing integration and subscription-status resolution
- `jobs/plan-trial-expiration-job.ts` — trial lifecycle cron job
- `socket.io/` — client portal real-time events (chat)
