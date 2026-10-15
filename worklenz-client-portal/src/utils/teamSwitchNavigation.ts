// After switching teams the app stays loaded: the API cache is cleared and the page content remounts,
// so everything is read again for the new team without a browser reload. A page that shows one item of
// the old team (a project, approval, change request or invoice) would 404 there, so those routes land
// on the dashboard instead.
const TEAM_SCOPED_PATHS = [
  /^\/projects\/[^/]+/,
  /^\/approvals\/[^/]+/,
  /^\/change-requests\/[^/]+/,
  /^\/invoices\/[^/]+/,
];

export const getPathAfterTeamSwitch = (pathname: string): string =>
  TEAM_SCOPED_PATHS.some(pattern => pattern.test(pathname)) ? '/dashboard' : pathname;
