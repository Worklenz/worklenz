# Client portal legacy routes: who can call what

`/api/client-portal/*` (file `worklenz-backend/src/routes/apis/client-portal-api-router.ts`). Every route below the public ones
runs `authenticateClient`, which on every request checks that the token is valid, the client is active, the login is
active and not disabled, the login still belongs to this portal, **and the person is still an Active company user of this
client** (the same check as v2). A removed or deactivated user is refused with 401/403 `ACCESS_REVOKED` on the next
request, even with a token that has not expired.

`requireClientSubject` (Active user with a fresh role) is added on top for the data routes. "Capability" is the role matrix in
`shared/client-portal-permissions.ts`.

| Route | Methods | Rule |
|---|---|---|
| `/invitation/validate`, `/invitation/validate/:slug` | GET | Public (invitation link). |
| `/auth/otp/request`, `/auth/otp/verify` | POST | Public, per-IP rate limits, per-address and per-IP code budgets. |
| `/auth/refresh`, `/handle-organization-invite` | POST | Public with a valid token in the body, per-IP rate limit. Refresh also requires an Active company user. |
| `/auth/login`, `/auth/forgot-password`, `/auth/reset-password`, `/invitation/accept` | POST | 410 (passwords were retired). |
| `/dashboard`, `/services*`, `/requests` (GET), `/requests/:id*` (GET), `/chats*` (GET), `/organization-settings`, `/projects*`, `/tasks/:id*` (GET) | GET | Authenticated + Active subject. Read-only history of the v1 features. |
| `/requests` (POST), `/requests/:id` (PUT, DELETE), `/requests/:id/comments` (POST), `/requests/:requestId/attachments/link`, `/chats` (POST), `/chats/:id/messages` (POST), `/tasks/:id/comments` (POST) | write | 410 `MOVED_IN_V2`. Nothing can be written through the v1 features. |
| `/tasks/:id/mark-viewed` | POST | Authenticated + Active subject. Only marks the person's own view. |
| `/invoices*` | GET | Authenticated + Active subject + the operator's "Show invoices" setting (404 when off). |
| `/invoices`, `/invoices/:id` (create, edit, delete), `/invoices/:id/send`, `/invoices/:id/mark-paid` | write | 403 `STAFF_ONLY`. Staff use their own routes. |
| `/invoices/:id/pay` | POST | Authenticated + Active subject + invoices on + `approve` capability (Client Admin). Stores payment details for the team to confirm; it does **not** mark the invoice paid. |
| `/profile` | GET, PUT | Authenticated + Active subject. Own profile only. |
| `/notifications*` | all | 410. Replaced by `/v2/notifications`, which is scoped to the person's projects and addressees with per-person read state. |
| `/upload` | POST | Authenticated + Active subject + `upload` capability. |
| `/attachments/unlinked`, `/attachments/:id`, `/requests/:requestId/attachments` | GET | Authenticated + Active subject. |
| `/attachments/:id` | DELETE | Authenticated + Active subject + `upload` capability. |
| `/auth/logout`, `/organizations`, `/organizations/switch`, `/organizations/accept-invite` | GET, POST | Authenticated (includes the Active company user check). Deliberately not behind `requireClientSubject`, because they must work for the portal switcher and invitations. |
| `/v2/*` | all | `requireClientSubject` first, then per-route capabilities. Items are further scoped by the gating chain in `services/client-portal-v2/scope.ts`. |

## Breaking changes for integrations

These admin routes no longer do what they did and answer 410 `MOVED_IN_V2`: `bulk-update`, `bulk-delete`, the company-user
`role` / `status` / delete routes and the team write routes. The admin console no longer calls them. Anything else that does
(scripts, mobile, third-party integrations) must move to `/api/v1/clients/portal/v2/*`.

`DELETE /api/v1/clients/portal/clients/:id` still means **deactivate** (the client stays in the list) and now sends
`Deprecation: true` and a `Link: <...>; rel="successor-version"` header pointing at the v2 organization route. A real delete,
restorable for 30 days, is `DELETE /api/v1/clients/portal/v2/organizations/:id`.

## How this is tested

`src/tests/client-portal-revocation-matrix.spec.ts` mounts the real routers and calls **every** protected route (read from the router
source, so new routes are picked up) with a still-valid token after access was taken away:

- **Removed** and **deactivated**: every legacy and v2 route answers 401/403 and nothing is written; `/auth/refresh` answers 401 and mints
  no token. The test keeps the login active and its link to the portal intact, so only the per-request contact check can stop it.
- **Unassigned or portal switched off**: every project/item route answers 4xx and writes nothing, the file-link route answers 404, and the
  list routes return empty lists.
