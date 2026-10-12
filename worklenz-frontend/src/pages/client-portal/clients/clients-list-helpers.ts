import type { ClientPortalClient } from '@/api/client-portal/client-portal-api';

export type PortalStatusKey = 'active' | 'invited' | 'not_invited' | 'expired';

export type ClientField = 'lastActivity' | 'phone' | 'poc' | 'company';

export type LastActivity =
  | { kind: 'signedIn'; at: string }
  | { kind: 'invited'; at: string }
  | { kind: 'never' };

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const PORTAL_STATUS_FILTER_VALUES: Array<'all' | PortalStatusKey> = [
  'all',
  'active',
  'invited',
  'not_invited',
  'expired',
];

export const DEFAULT_VISIBLE_FIELDS: Record<ClientField, boolean> = {
  lastActivity: true,
  phone: true,
  poc: true,
  company: true,
};

const VISIBLE_FIELDS_STORAGE_KEY = 'clientPortalClientsVisibleFields';

/**
 * The server derives the portal status once (it is also what the status filter and the stat
 * cards count), so the list only reads it. The fallback covers responses without the field.
 */
export const getPortalStatusKey = (client: ClientPortalClient): PortalStatusKey =>
  client.portal_status?.status ?? (client.has_portal_access ? 'active' : 'not_invited');

export const getLastActivity = (client: ClientPortalClient): LastActivity => {
  if (client.last_login_at) return { kind: 'signedIn', at: client.last_login_at };

  const status = getPortalStatusKey(client);
  if ((status === 'invited' || status === 'expired') && client.invitation_sent_at) {
    return { kind: 'invited', at: client.invitation_sent_at };
  }

  return { kind: 'never' };
};

/**
 * Names of a company's POCs. Older records have no company users yet, so the free-text
 * contact_person stands in until they do.
 */
export const getPocNames = (client: ClientPortalClient): string[] => {
  const pocs = (client.poc_names ?? []).map(name => name.trim()).filter(Boolean);
  if (pocs.length > 0) return pocs;

  const contactPerson = client.contact_person?.trim();
  return contactPerson ? [contactPerson] : [];
};

export const getClientInitials = (name?: string | null): string => {
  // Skip stray symbols such as the "&" in "Harbor & Co" so they never end up as an initial.
  const words = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(word => /^[\p{L}\p{N}]/u.test(word));
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

/** Stable index for picking an avatar color from a palette, so a client keeps its color. */
export const getStableColorIndex = (seed: string, paletteSize: number): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % paletteSize;
};

export const loadVisibleFields = (): Record<ClientField, boolean> => {
  try {
    const stored = window.localStorage.getItem(VISIBLE_FIELDS_STORAGE_KEY);
    if (!stored) return DEFAULT_VISIBLE_FIELDS;

    const parsed = JSON.parse(stored) as Partial<Record<ClientField, unknown>>;
    return (Object.keys(DEFAULT_VISIBLE_FIELDS) as ClientField[]).reduce(
      (fields, field) => ({
        ...fields,
        [field]:
          typeof parsed[field] === 'boolean'
            ? (parsed[field] as boolean)
            : DEFAULT_VISIBLE_FIELDS[field],
      }),
      DEFAULT_VISIBLE_FIELDS
    );
  } catch {
    return DEFAULT_VISIBLE_FIELDS;
  }
};

export const saveVisibleFields = (fields: Record<ClientField, boolean>): void => {
  try {
    window.localStorage.setItem(VISIBLE_FIELDS_STORAGE_KEY, JSON.stringify(fields));
  } catch {
    // Storage can be unavailable (private mode, blocked site data); the choice just won't persist.
  }
};
