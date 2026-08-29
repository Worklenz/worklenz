# `ee/` — Business Edition features

Everything in this directory is licensed under the [Worklenz Commercial License](LICENSE.md), **not** the AGPLv3 license that covers the rest of `worklenz-frontend/`. See [docs/SELF_HOSTING.md](../../../docs/SELF_HOSTING.md) at the repository root for the full picture of what's free vs. commercial across the whole project.

## What's here

UI for the features gated server-side by `worklenz-backend/src/ee/`:

- `pages/client-portal/`, `pages/client-view/`, `components/client-portal/`, `layouts/` — client portal admin UI and the client-facing view
- `pages/admin-center/billing/`, `components/admin-center/billing/` — billing, plans, upgrade flow (Paddle checkout)
- `components/projects/project-finance/`, `components/projects/project-ratecard/`, `pages/settings/rate-card-settings/` — project finance and rate cards
- `components/settings/integrations/slack/`, `components/projects/integrations/` — Slack integration
- `components/LicenseExpiredModal/`, `pages/license-expired/` — the UI shown when a Business Edition feature is accessed without a qualifying plan

## You can

Read, copy, modify, and run this code for development, testing, and non-production evaluation, without a subscription — see [LICENSE.md](LICENSE.md) for the exact terms.

## You need a subscription to

Run this code in production — including self-hosted production use for your own organization's business, not just a hosted-for-others service. See [LICENSE.md](LICENSE.md) for the full grant and restrictions.

## Not a substitute for server-side enforcement

Every screen here assumes the corresponding backend route already enforces the plan check (`requireBusinessPlan` / `requireBusinessPlanForOrganization` in `worklenz-backend/src/ee/`). Hiding a feature in this UI is a UX nicety, not the gate — a client that bypasses the UI and calls the API directly must still be rejected server-side. Don't add a `src/ee/` screen for a feature whose backend route isn't gated; fix the backend gate first.
