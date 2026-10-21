import db from "../../config/db";
import { containsPattern, splitList } from "./list-params";
import { getColor } from "../../shared/utils";
import { listUnreadThreadsForClient } from "./discussions.service";
import { badRequest, notFound } from "./errors";
import { Queryable } from "./types";
import { USER_VIEW_SQL } from "./users.service";

/**
 * Client organizations (the `clients` table) as the v2 admin console lists them. An organization's
 * portal access is derived from its users: Active when any user is Active, otherwise Invited,
 * Deactivated, or none.
 */

export type OrganizationPortalAccess = "active" | "invited" | "deactivated" | "none";

export interface OrganizationView {
  id: string;
  name: string;
  initials: string;
  color: string;
  /** The client user the invitation link is created for; null when the organization has no portal admin. */
  primary_contact_id: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  phone: string | null;
  /** Money owed per currency, largest first. Currencies are never added together. */
  outstanding: Array<{ currency: string; amount: number }>;
  portal_access: OrganizationPortalAccess;
  active_users: number;
  invited_users: number;
  deactivated_users: number;
  total_users: number;
  portal_projects: number;
  /** Approvals awaiting this client's decision plus change requests waiting for their information. */
  awaiting_client: number;
  awaiting_approvals: number;
  awaiting_change_requests: number;
}

export const initialsOf = (name: string): string =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0] ?? "")
    .join("")
    .toUpperCase() || "?";

const USER_STATE_SQL = `
  CASE
    WHEN cc.disabled_at IS NOT NULL THEN 'deactivated'
    WHEN cc.client_user_id IS NOT NULL AND cu.status IS DISTINCT FROM 'active' THEN 'deactivated'
    WHEN cc.client_user_id IS NOT NULL AND cc.activated_at IS NOT NULL THEN 'active'
    ELSE 'invited'
  END
`;

// $1 = team id. Every counter a list row or workspace header needs, per organization.
const ORGANIZATIONS_SQL = `
  SELECT c.id,
         COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS display_name,
         c.phone, c.contact_person, c.email,
         pc.id AS primary_id, pc.name AS primary_name, pc.email AS primary_email,
         COALESCE(uc.total, 0)::int AS total_users,
         COALESCE(uc.active, 0)::int AS active_users,
         COALESCE(uc.invited, 0)::int AS invited_users,
         COALESCE(uc.deactivated, 0)::int AS deactivated_users,
         COALESCE(pp.n, 0)::int AS portal_projects,
         (COALESCE(ap.awaiting, 0) + COALESCE(cr.more_info, 0))::int AS awaiting_client,
         COALESCE(ap.awaiting, 0)::int AS awaiting_approvals,
         COALESCE(cr.more_info, 0)::int AS awaiting_change_requests,
         COALESCE(bal.outstanding, '[]'::json) AS outstanding
    FROM clients c
    LEFT JOIN LATERAL (
      SELECT cc.id, cc.name, cc.email
        FROM client_contacts cc
       WHERE cc.client_id = c.id AND cc.role = 'admin' AND cc.disabled_at IS NULL
       ORDER BY cc.created_at, cc.id
       LIMIT 1
    ) pc ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS total,
             COUNT(*) FILTER (WHERE s.state = 'active') AS active,
             COUNT(*) FILTER (WHERE s.state = 'invited') AS invited,
             COUNT(*) FILTER (WHERE s.state = 'deactivated') AS deactivated
        FROM (
          SELECT (${USER_STATE_SQL}) AS state
            FROM client_contacts cc
            LEFT JOIN client_users cu ON cu.id = cc.client_user_id
           WHERE cc.client_id = c.id
        ) s
    ) uc ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS n
        FROM project_client_settings pcs
        JOIN projects p ON p.id = pcs.project_id
       WHERE p.client_id = c.id AND pcs.portal_enabled IS TRUE
    ) pp ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS awaiting
        FROM client_portal_approvals a
       WHERE a.client_id = c.id AND a.status = 'awaiting'
    ) ap ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS more_info
        FROM client_portal_change_requests r
       WHERE r.client_id = c.id AND r.status = 'more_info'
    ) cr ON TRUE
    LEFT JOIN LATERAL (
      SELECT COALESCE(json_agg(json_build_object('currency', b.currency, 'amount', b.amount) ORDER BY b.amount DESC), '[]'::json) AS outstanding
        FROM (
          SELECT i.currency, SUM(i.amount - COALESCE(i.paid_amount, 0))::float AS amount
            FROM client_portal_invoices i
           WHERE i.client_id = c.id AND i.deleted_at IS NULL
             AND i.status IN ('sent', 'pending', 'overdue') AND COALESCE(i.payment_status, '') <> 'paid'
           GROUP BY i.currency
          HAVING SUM(i.amount - COALESCE(i.paid_amount, 0)) > 0
        ) b
    ) bal ON TRUE
   WHERE c.team_id = $1 AND c.deleted_at IS NULL
`;

const accessOf = (row: any): OrganizationPortalAccess => {
  if (row.active_users > 0) return "active";
  if (row.invited_users > 0) return "invited";
  if (row.total_users > 0) return "deactivated";
  return "none";
};

export const mapOrganizationRow = (row: any): OrganizationView => ({
  id: row.id,
  name: row.display_name,
  initials: initialsOf(row.display_name),
  color: getColor(row.display_name),
  primary_contact_id: row.primary_id ?? null,
  primary_contact_name: row.primary_name ?? row.contact_person ?? null,
  primary_contact_email: row.primary_email ?? row.email ?? null,
  phone: row.phone ?? null,
  outstanding: Array.isArray(row.outstanding)
    ? row.outstanding.map((entry: { currency: string; amount: number }) => ({
        currency: String(entry.currency),
        amount: Number(entry.amount) || 0,
      }))
    : [],
  portal_access: accessOf(row),
  active_users: row.active_users,
  invited_users: row.invited_users,
  deactivated_users: row.deactivated_users,
  total_users: row.total_users,
  portal_projects: row.portal_projects,
  awaiting_client: row.awaiting_client,
  awaiting_approvals: row.awaiting_approvals ?? 0,
  awaiting_change_requests: row.awaiting_change_requests ?? 0,
});

/** Sortable list columns and the SQL each one orders by. Never interpolate a client value into SQL. */
const ORGANIZATION_SORTS: Record<string, string> = {
  client: "LOWER(o.display_name)",
  contact_name: "LOWER(COALESCE(o.primary_name, o.contact_person))",
  contact_email: "LOWER(COALESCE(o.primary_email, o.email))",
  users: "o.total_users",
  projects: "o.portal_projects",
  awaiting: "o.awaiting_client",
  access: "CASE WHEN o.active_users > 0 THEN 1 WHEN o.invited_users > 0 THEN 2 WHEN o.total_users > 0 THEN 3 ELSE 4 END",
};

const ORGANIZATION_ACCESS_FILTERS: Record<string, string> = {
  active: "o.active_users > 0",
  invited: "o.active_users = 0 AND o.invited_users > 0",
  deactivated: "o.active_users = 0 AND o.invited_users = 0 AND o.total_users > 0",
  none: "o.total_users = 0",
};

export interface OrganizationsParams {
  search?: string;
  sort?: string;
  order?: string;
  access?: string;
  page?: number;
  limit?: number;
}

export async function listOrganizations(teamId: string, params: OrganizationsParams) {
  const page = Math.max(Number(params.page) || 1, 1);
  const limit = Math.min(Math.max(Number(params.limit) || 10, 1), 100);
  const values: unknown[] = [teamId];
  let searchClause = "";

  const search = (params.search ?? "").trim();
  if (search) {
    values.push(containsPattern(search));
    const n = values.length;
    searchClause = `AND (c.name ILIKE $${n} OR c.company_name ILIKE $${n} OR c.email ILIKE $${n} OR c.contact_person ILIKE $${n}
      OR c.phone ILIKE $${n} OR pc.name ILIKE $${n} OR pc.email ILIKE $${n})`;
  }

  let accessClause = "";
  // A comma-separated list keeps the clients that match any of the chosen access states.
  const accessStates = splitList(params.access);
  if (accessStates.length) {
    const clauses = accessStates.map(state => ORGANIZATION_ACCESS_FILTERS[state]);
    if (clauses.some(clause => !clause)) throw badRequest("Invalid access filter");
    accessClause = `WHERE ${clauses.map(clause => `(${clause})`).join(" OR ")}`;
  }

  const sortSql = params.sort ? ORGANIZATION_SORTS[params.sort] : undefined;
  if (params.sort && !sortSql) throw badRequest("Invalid sort column");
  const direction = params.order === "desc" ? "DESC" : "ASC";
  const orderBy = sortSql ? `${sortSql} ${direction} NULLS LAST, o.display_name` : "o.display_name";

  values.push(limit, (page - 1) * limit);

  const rows = await db.query(
    `SELECT o.*, COUNT(*) OVER()::int AS total_count
       FROM (${ORGANIZATIONS_SQL} ${searchClause}) o
      ${accessClause}
      ORDER BY ${orderBy}
      LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return {
    items: rows.rows.map(mapOrganizationRow),
    total: rows.rows[0]?.total_count ?? 0,
    page,
    limit,
  };
}

export async function getOrganization(q: Queryable, teamId: string, organizationId: string): Promise<OrganizationView> {
  const result = await q.query(`${ORGANIZATIONS_SQL} AND c.id = $2`, [teamId, organizationId]);
  if (result.rows.length === 0) throw notFound("Client");
  return mapOrganizationRow(result.rows[0]);
}

export interface OrganizationStats {
  organizations: number;
  active_users: number;
  invited_users: number;
  expired_invites: number;
  awaiting_client_action: number;
}

/**
 * The stat row on the Clients page: organizations, Active users, Invited users (with how many of
 * those expired), and everything awaiting a client (approvals awaiting plus change requests that
 * need the client's information).
 */
export async function getOrganizationStats(q: Queryable, teamId: string): Promise<OrganizationStats> {
  const result = await q.query(
    `SELECT
       (SELECT COUNT(*)::int FROM clients c WHERE c.team_id = $1 AND c.deleted_at IS NULL) AS organizations,
       COUNT(*) FILTER (WHERE s.state = 'active')::int AS active_users,
       COUNT(*) FILTER (WHERE s.state = 'invited')::int AS invited_users,
       COUNT(*) FILTER (WHERE s.state = 'invited' AND s.lapsed)::int AS expired_invites,
       (SELECT COUNT(*)::int FROM client_portal_approvals a
         WHERE a.organization_team_id = $1 AND a.status = 'awaiting')
       + (SELECT COUNT(*)::int FROM client_portal_change_requests r
           WHERE r.organization_team_id = $1 AND r.status = 'more_info') AS awaiting_client_action
     FROM (
       SELECT (${USER_STATE_SQL}) AS state,
              EXISTS (
                SELECT 1 FROM client_invitations ci
                 WHERE ci.client_contact_id = cc.id AND ci.status = 'pending' AND ci.expires_at <= NOW()
                   AND ci.created_at = (SELECT MAX(i2.created_at) FROM client_invitations i2 WHERE i2.client_contact_id = cc.id)
              ) AS lapsed
         FROM client_contacts cc
         JOIN clients c ON c.id = cc.client_id AND c.deleted_at IS NULL
         LEFT JOIN client_users cu ON cu.id = cc.client_user_id
        WHERE cc.team_id = $1
     ) s`,
    [teamId]
  );

  const row = result.rows[0] ?? {};
  return {
    organizations: row.organizations ?? 0,
    active_users: row.active_users ?? 0,
    invited_users: row.invited_users ?? 0,
    expired_invites: row.expired_invites ?? 0,
    awaiting_client_action: row.awaiting_client_action ?? 0,
  };
}

export interface NeedsAttentionItem {
  kind: "invite_expired" | "approval_awaiting" | "change_request_review" | "unread_message";
  /** The user, approval, request or discussion this row is about. */
  label: string;
  /** The approver, requester or project, depending on the kind. */
  detail: string | null;
  /** Set on an expired invitation when the client used the recovery request ("asked for a new link"). */
  flag: "asked_new_link" | null;
  target: { type: "user" | "approval" | "change_request" | "thread"; id: string };
}

export interface OrganizationOverview {
  organization: OrganizationView;
  stats: { portal_projects: number; awaiting_client_action: number; open_change_requests: number };
  needs_attention: NeedsAttentionItem[];
}

/**
 * The Client Workspace Overview: counts, plus "Needs attention" - expired invitations (and whether the
 * client asked for a new link), approvals waiting on a named approver, change requests needing review
 * and unread client messages. Each row opens its item.
 */
export async function getOrganizationOverview(
  q: Queryable,
  teamId: string,
  userId: string,
  organizationId: string
): Promise<OrganizationOverview> {
  const organization = await getOrganization(q, teamId, organizationId);

  const [expired, approvals, requests, threads, openRequests] = await Promise.all([
    q.query(
      `SELECT u.id, u.name, (u.new_link_requested_at IS NOT NULL) AS asked
         FROM (${USER_VIEW_SQL}) u
        WHERE u.client_id = $2 AND u.status_key = 'invited' AND u.invitation_lapsed
        ORDER BY u.name`,
      [teamId, organizationId]
    ),
    q.query(
      `SELECT id, title, approver_name FROM client_portal_approvals
        WHERE organization_team_id = $1 AND client_id = $2 AND status = 'awaiting' ORDER BY created_at`,
      [teamId, organizationId]
    ),
    q.query(
      `SELECT r.id, r.title, r.requester_name FROM client_portal_change_requests r
        WHERE r.organization_team_id = $1 AND r.client_id = $2 AND r.status IN ('submitted', 'under_review')
        ORDER BY r.submitted_at`,
      [teamId, organizationId]
    ),
    listUnreadThreadsForClient(q, teamId, userId, organizationId),
    q.query(
      `SELECT COUNT(*)::int AS n FROM client_portal_change_requests
        WHERE organization_team_id = $1 AND client_id = $2 AND status NOT IN ('completed', 'rejected', 'cancelled')`,
      [teamId, organizationId]
    ),
  ]);

  const needsAttention: NeedsAttentionItem[] = [
    ...expired.rows.map(row => ({
      kind: "invite_expired" as const,
      label: row.name as string,
      detail: null,
      flag: row.asked ? ("asked_new_link" as const) : null,
      target: { type: "user" as const, id: row.id as string },
    })),
    ...approvals.rows.map(row => ({
      kind: "approval_awaiting" as const,
      label: row.title as string,
      detail: row.approver_name as string,
      flag: null,
      target: { type: "approval" as const, id: row.id as string },
    })),
    ...requests.rows.map(row => ({
      kind: "change_request_review" as const,
      label: row.title as string,
      detail: row.requester_name as string,
      flag: null,
      target: { type: "change_request" as const, id: row.id as string },
    })),
    ...threads.map(thread => ({
      kind: "unread_message" as const,
      label: thread.context.label,
      detail: thread.project_name,
      flag: null,
      target: { type: "thread" as const, id: thread.id },
    })),
  ];

  return {
    organization,
    stats: {
      portal_projects: organization.portal_projects,
      awaiting_client_action: organization.awaiting_client,
      open_change_requests: openRequests.rows[0]?.n ?? 0,
    },
    needs_attention: needsAttention,
  };
}
