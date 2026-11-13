import { Request, Response } from "express";

/**
 * Return page for "Sign in with Apple" in the Windows desktop app.
 *
 * The app opens Apple's page in the browser. Apple answers with a form POST to
 * this endpoint, which only hands the result to the app that is waiting on the
 * same computer: it redirects to http://127.0.0.1:<port>/ with the ID token.
 * Nothing is verified or stored here; the app then sends the ID token to
 * POST /secure/apple/mobile, the same check the iPhone and Mac apps use.
 *
 * `state` is `<port>.<random>`, made by the app. Only a loopback address on an
 * unprivileged port is ever redirected to, so this cannot be used to send
 * people to another site.
 */
const STATE_PATTERN = /^(\d{4,5})\.([A-Za-z0-9._~-]{16,128})$/;
const JWT_PATTERN = /^[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}$/;
const MAX_ID_TOKEN_LENGTH = 8192;
const MAX_ERROR_LENGTH = 64;

export function buildAppleDesktopRedirect(body: Record<string, unknown> | undefined): string | null {
  const state = typeof body?.state === "string" ? body.state : "";
  const match = STATE_PATTERN.exec(state);
  if (!match) return null;
  const port = Number(match[1]);
  if (port < 1024 || port > 65535) return null;

  const target = new URL(`http://127.0.0.1:${port}/`);
  target.searchParams.set("state", match[2]);

  const idToken = body?.id_token;
  const error = body?.error;
  if (typeof idToken === "string" && idToken.length <= MAX_ID_TOKEN_LENGTH && JWT_PATTERN.test(idToken)) {
    target.searchParams.set("id_token", idToken);
  } else if (typeof error === "string") {
    // For example `user_cancelled_authorize`.
    target.searchParams.set("error", error.slice(0, MAX_ERROR_LENGTH).replace(/[^\w.-]/g, "_"));
  } else {
    target.searchParams.set("error", "invalid_response");
  }
  return target.toString();
}

export function appleDesktopCallback(req: Request, res: Response) {
  const target = buildAppleDesktopRedirect(req.body);
  // The token is in the address for one redirect; keep it out of caches and referrers.
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (!target) return res.status(400).type("text/plain").send("Invalid sign-in response.");
  return res.redirect(303, target);
}
