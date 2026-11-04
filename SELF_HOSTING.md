# Self-Hosting Worklenz

Worklenz is open-source software licensed under the [GNU Affero General Public License Version 3 (AGPLv3)](LICENSE).

## What's included

Everything in this repository — projects, tasks, boards, time tracking, team management, comments, attachments, scheduling, client portal, the core REST API, and notifications — is free to self-host, modify, and redistribute under the terms of [LICENSE](LICENSE).

## Google One Tap login

One Tap is disabled by default and signs in **existing accounts already linked to Google**. New users can sign up using the existing Google sign-in flow. One Tap does not link accounts by email or accept an invitation on its own. Keep another sign-in option available: Google or the browser can suppress the prompt.

The existing Google redirect flow requires its own client secret, callback URL and frontend Google-login setting. In the current frontend this setting is a build-time variable; changing it in a running container alone does not enable its button. One Tap's settings below are backend runtime settings. The existing redirect and mobile flows have separate account-linking behavior; their email-based linking policy should be reviewed independently before exposing them to untrusted users.

To enable it on a self-hosted deployment:

1. In Google Cloud, create or reuse a **Web application** OAuth client and configure its consent screen. Add every frontend origin (scheme, hostname and port) to its authorized JavaScript origins. Use HTTPS outside local development.
2. Set the backend environment variables below, run the database migrations, and restart the backend. The frontend reads this public configuration from the backend at runtime; a frontend rebuild and a Google client secret are not needed for One Tap itself.

```dotenv
GOOGLE_ONE_TAP_ENABLED=true
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_ONE_TAP_ALLOWED_ORIGINS=https://worklenz.example.com
# Optional: restrict login to these verified Google Workspace hosted domains.
GOOGLE_ONE_TAP_HOSTED_DOMAINS=
SESSION_COOKIE_SECURE=true
SESSION_SECRET=replace-with-a-unique-random-secret-at-least-32-characters
```

`GOOGLE_ONE_TAP_ALLOWED_ORIGINS` is a comma-separated list of exact frontend origins, with no path or trailing slash. Include them in `FRONTEND_URL` or `SERVER_CORS` when the frontend and API use different origins. `GOOGLE_ONE_TAP_HOSTED_DOMAINS` is an optional comma-separated list checked against Google's signed `hd` claim; an email suffix alone is not sufficient. `SESSION_SECRET` should be generated with `openssl rand -hex 32`. One Tap fails closed if its settings are incomplete, the secret is too short, or a non-local origin is configured without secure cookies.

To diagnose configuration, `GET /secure/google/one-tap/config` returns an `enabled` flag and, when enabled, the public client ID. `POST /secure/google/one-tap/challenge` and `POST /secure/google/one-tap/login` require the session cookie, `X-CSRF-Token`, and an allowed `Origin`. The login request body is `{ "credential": "<Google ID token>" }`; failed authentication returns a generic 401 response. These endpoints are for the main application, not the client portal.

Serve the frontend and API from the same site so that the session's `SameSite=Lax` cookie accompanies requests. Terminate HTTPS at a trusted reverse proxy, forward `X-Forwarded-Proto`, and prevent direct access to the backend; Express trusts one proxy hop. Local HTTP origins on `localhost` or `127.0.0.1` are supported for development with `SESSION_COOKIE_SECURE=false`. Google requires HTTPS for One Tap outside localhost. If a proxy or hosting platform sets its own CSP, allow Google's GIS client, style, connection, and frame URLs as described in [Google's setup guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid#content_security_policy).

The backend validates the Google signature, issuer, audience, expiration, verified email and optional hosted domain. Each attempt uses a five-minute, session-bound nonce consumed atomically in PostgreSQL, along with Worklenz CSRF protection, an exact origin check and rate limits. Login regenerates the Passport session. Access tokens and ID tokens should not be logged or included in URLs. Changes to these settings require a backend restart in typical container deployments.

## Network use and AGPLv3 §13

If you modify the AGPLv3-licensed parts of Worklenz and make the result
available to users over a network, AGPLv3 §13 requires you to offer those users
access to the Corresponding Source of your modified version.
