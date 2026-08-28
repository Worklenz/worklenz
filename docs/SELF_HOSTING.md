# Self-Hosting Worklenz

Worklenz is open-core: the core product is free to self-host under AGPLv3, and a
set of Business Plan features are available under a separate Commercial License.

## What's free (AGPLv3)

Everything in this repository except the locations listed below — projects,
tasks, boards, time tracking, team management, comments, attachments,
scheduling, self-hosted auth, the core REST API, and notifications. You can
self-host, modify, and redistribute this part under the terms of
[LICENSE](../LICENSE).

## What requires a Commercial License

The following are licensed separately (see the `LICENSE.md` in each location) and
are **free to read, copy, and modify for development and testing**, but require a
paid Worklenz Business Edition subscription — or a separate written agreement —
to run in production, including in a self-hosted deployment used for an
organization's own business:

- `worklenz-backend/src/ee/` — billing, subscriptions, Slack integration,
  project finance and rate cards, client portal backend
- `worklenz-frontend/src/ee/` — the corresponding UI for all of the above
- `worklenz-client-portal/` — the entire client portal application

## Evaluating before you buy

You can build and run this repository as-is for development and evaluation
without a subscription. Nothing needs to be stripped out or disabled to try it
locally.

## Current limitation — read before relying on this document

As of this writing, the codebase does not yet technically enforce the
production-use restriction above for self-hosted deployments: a self-hosted
installation currently resolves to full Business Plan access automatically,
regardless of subscription status. Whether to change that default (so
self-hosted installs default to the free tier, matching the license terms
above, the way cloud free-tier accounts already work) is a pending product
decision. Until it is, this document describes the *intended* licensing terms,
which the Commercial License already asks self-hosters to honor — but there is
no technical gate behind it yet.

## How a plan is elevated above free (cloud)

For cloud accounts, `subscription_type` is only ever changed by Paddle billing
webhooks (`worklenz-backend/src/ee/controllers/billing-controller.ts`) — the
normal paid-subscription path. Self-hosted deployments take no billing path;
they get Business Plan access purely from the self-hosted default noted above,
not from any billing event.

## Network use and AGPLv3 §13

If you modify the AGPLv3-licensed parts of Worklenz and make the result
available to users over a network, AGPLv3 §13 requires you to offer those users
access to the Corresponding Source of your modified version.
