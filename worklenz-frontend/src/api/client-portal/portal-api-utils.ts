/**
 * Builds a query string from an object, skipping undefined, null and empty-string values so a blank
 * search box or an unset filter never reaches the API. Returns '' when nothing is left.
 */
export const buildQuery = (params?: object): string => {
  if (!params) return '';
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
};

/** The v2 admin API root, relative to the shared base query (`/api/v1`). */
export const PORTAL_V2 = '/clients/portal/v2';

interface PortalErrorShape {
  data?: { message?: unknown; body?: { code?: unknown } | null };
}

/**
 * The server's own message for a failed v2 call (it is already user-safe: PortalError text only),
 * or `fallback` when the failure was a network error or an unexpected 500.
 */
export const getPortalErrorMessage = (error: unknown, fallback: string): string => {
  const message = (error as PortalErrorShape | null)?.data?.message;
  return typeof message === 'string' && message.trim().length > 0 ? message : fallback;
};

/** The machine-readable `code` of a failed v2 call (e.g. `LAST_CLIENT_ADMIN`), when it has one. */
export const getPortalErrorCode = (error: unknown): string | null => {
  const body = (error as PortalErrorShape | null)?.data?.body;
  return typeof body?.code === 'string' ? body.code : null;
};

/** The CSV of the audit log for the given filters, as an absolute URL the browser can open to download it. */
export const getAuditExportUrl = (
  base: string,
  params?: { search?: string; type?: string; side?: string; organization_id?: string; date_from?: string; date_to?: string }
): string => `${base.replace(/\/$/, '')}${PORTAL_V2}/audit/export${buildQuery(params)}`;
