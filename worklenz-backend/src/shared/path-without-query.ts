/**
 * A request URL without its query string.
 *
 * Route exemptions (skip the login check, skip CSRF) must match on this, never on the raw URL: the query
 * string is attacker-controlled, so `/api/v1/anything?x=/client-portal/auth/login` would otherwise look like
 * an exempt route and bypass the very checks the exemption list is meant to be a narrow exception to.
 */
export const pathWithoutQuery = (url: string): string => url.split("?")[0].split("#")[0];
