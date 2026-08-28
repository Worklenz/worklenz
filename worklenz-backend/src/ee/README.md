# `ee/` — Business Edition features

Everything in this directory is licensed under the [Worklenz Commercial License](LICENSE.md), **not** the AGPLv3 license that covers the rest of `worklenz-backend/`. See [docs/SELF_HOSTING.md](../../../docs/SELF_HOSTING.md) at the repository root for the full picture of what's free vs. commercial across the whole project.

## What's here

- `controllers/`, `routes/apis/` — client portal backend, project finance & rate cards, Slack integration, billing/subscriptions
- `middlewares/subscription-middleware.ts` — `hasBusinessPlanAccess()` / `requireBusinessPlan`, the server-side plan check that gated routes (in `ee/` and in core) call before allowing a Business Edition action
- `shared/paddle-utils.ts`, `shared/paddle-requests.ts` — Paddle billing integration and subscription-status resolution
- `jobs/plan-trial-expiration-job.ts` — trial lifecycle cron job
- `socket.io/` — client portal real-time events (chat)

## You can

Read, copy, modify, and run this code for development, testing, and non-production evaluation, without a subscription — see [LICENSE.md](LICENSE.md) for the exact terms.

## You need a subscription to

Run this code in production — including self-hosted production use for your own organization's business, not just a hosted-for-others service. See [LICENSE.md](LICENSE.md) for the full grant and restrictions.

## Why core code imports from here

Core (AGPLv3) controllers and routers in `worklenz-backend/src/` import plan-check functions from this directory (`hasBusinessPlanAccess`, `checkTeamSubscriptionStatus`, `getTeamMemberSeatLimit`, `isRestrictedFromProPlanFeatures`, and similar) so that free-tier limits — seat caps, storage caps, Pro-plan feature restrictions — are enforced server-side wherever they apply, not just inside `ee/` itself. This is intentional: it's the same shape Papermark uses (`ee/limits/` consulted from core `app/(dashboard)/`), and it means core currently builds and runs only with this directory present — there is no "strip `ee/`, still get a working core" build today.
