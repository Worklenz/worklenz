/**
 * Client Portal v2 contract types (admin console).
 *
 * Wire format is snake_case with string UUID ids, matching the newest admin API
 * (`company-users-api.ts`). These types are hand-mirrored in
 * `worklenz-backend/src/controllers/client-portal/interfaces.ts`; there is no shared package.
 */

/**
 * Whether an item (task, file, milestone, discussion message) is shared with the client.
 * `internal` is the default for every existing and new item.
 */
export type PortalVisibility = 'internal' | 'client';

/** Which side of the portal caused an event or wrote a message. */
export type PortalSide = 'client' | 'internal';

/** Paged list envelope body used by every v2 list endpoint. */
export interface PagedList<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PagedParams {
  page?: number;
  limit?: number;
  search?: string;
  /** Column key to order by; the server rejects keys it does not know. */
  sort?: string;
  order?: 'asc' | 'desc';
}

/** Short reference to a team member (staff), never a client user. */
export interface StaffRef {
  id: string;
  name: string;
  short_name: string;
  initials: string;
  color: string;
}
