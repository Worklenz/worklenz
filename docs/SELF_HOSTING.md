# Self-Hosting Worklenz

**Status: draft, pending legal review and a product decision noted below — not yet final.**

Worklenz is open-core: the core product is free to self-host under AGPLv3, and a set of Business Plan features are available under a separate Commercial License.

## What's free (AGPLv3)

Everything in this repository except the locations listed below — projects, tasks, boards, time tracking, team management, comments, attachments, scheduling, self-hosted auth, the core REST API, and notifications. You can self-host, modify, and redistribute this part under the terms of [LICENSE](../LICENSE).

## What requires a Commercial License

The following are licensed separately (see the `LICENSE.md` in each location) and are **free to read, copy, and modify for development and testing**, but require a paid Worklenz Business Edition subscription — or a separate written agreement — to run in production, including in a self-hosted deployment used for an organization's own business:

- `worklenz-backend/src/ee/` — billing, subscriptions, AppSumo/lifetime-deal handling, Slack integration, project finance and rate cards, client portal backend
- `worklenz-frontend/src/ee/` — the corresponding UI for all of the above
- `worklenz-client-portal/` — the entire client portal application

## Evaluating before you buy

You can build and run this repository as-is for development and evaluation without a subscription. Nothing needs to be stripped out or disabled to try it locally, and — see the limitation below — a self-hosted deployment today gets full Business Plan access by default, so there is currently no separate "request an evaluation license" step to go through. If that default changes (see below), evaluation will instead work the same way the cloud product's trial does: full Business Plan access for a fixed trial window, resolved server-side by the same `hasBusinessPlanAccess()` check described in each `ee/README.md` ([backend](../worklenz-backend/src/ee/README.md), [frontend](../worklenz-frontend/src/ee/README.md)), not by anything you configure yourself.

## Current limitation — read before relying on this document

As of this writing, the codebase does not yet technically enforce the production-use restriction above for self-hosted deployments: a self-hosted installation currently resolves to full Business Plan access automatically, regardless of subscription status. Whether to change that default (so self-hosted installs default to the free tier, matching the license terms above, the way cloud free-tier accounts already work) is a pending product decision, not yet made. Until it is, this document describes the *intended* licensing terms, which the Commercial License already asks self-hosters to honor — but there is no technical gate behind it yet.

## How a plan is elevated above free (cloud)

For cloud accounts, `subscription_type`/`business_plan_override` is only ever changed by one of:

1. **Paddle billing webhooks** (`worklenz-backend/src/ee/controllers/billing-controller.ts`) — the normal paid-subscription path.
2. **AppSumo/lifetime-deal coupon redemption** (`worklenz-backend/src/controllers/admin-center-controller.ts`) — a self-service flow where redeeming 5 or more lifetime-deal codes sets `business_plan_override = TRUE`. This is a legitimate, user-initiated redemption path, distinct from Paddle.

Self-hosted deployments take neither path — they get Business Plan access purely from the `SELF_HOSTED` default noted above, not from any billing event.
