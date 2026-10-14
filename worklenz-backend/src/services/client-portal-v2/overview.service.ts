import db from "../../config/db";
import { OVERDUE_SQL } from "../../controllers/client-portal/client-portal-invoice-helpers";
import { htmlToPlainText } from "../../shared/utils";
import { getApprovalStats, listApprovals } from "./approvals.service";
import { getChangeRequestStats, listChangeRequests } from "./change-requests.service";
import { countUnreadThreads, listThreads } from "./discussions.service";
import { badRequest } from "./errors";
import { EFFECTIVE_MILESTONES_SQL } from "./milestone-source";
import { Queryable } from "./types";

/**
 * The staff Overview: one request returns a keyed block per widget so the page loads in one round
 * trip, hidden widgets cost nothing, and a failing widget does not take the others down.
 */

export const OVERVIEW_WIDGET_KEYS = [
  "kpi_awaiting_approvals",
  "kpi_open_change_requests",
  "kpi_delayed_milestones",
  "kpi_unread_discussions",
  "kpi_overdue_invoices",
  "pending_approvals",
  "change_requests",
  "upcoming_milestones",
  "latest_discussions",
  "mentions_me",
  "approvals_by_status",
  "cr_by_status",
  "needs_attention",
] as const;
export type OverviewWidgetKey = (typeof OVERVIEW_WIDGET_KEYS)[number];

export const isOverviewWidgetKey = (value: unknown): value is OverviewWidgetKey =>
  typeof value === "string" && (OVERVIEW_WIDGET_KEYS as readonly string[]).includes(value);

/** Rows each list widget returns; the page links to the full list for the rest. */
const LIST_LIMIT = 5;
const MILESTONE_LIMIT = 8;
const ATTENTION_LIMIT = 8;

export type OverviewWidgetResult = { data: unknown } | { error: string };

interface Ctx {
  teamId: string;
  userId: string;
}

// A milestone is late when it is flagged delayed, or still open after its target date.
const MILESTONE_LATE_SQL = `(m.status = 'delayed' OR (m.status <> 'completed' AND m.target_date < CURRENT_DATE))`;

// $1 = team id. Only portal-enabled projects: those are the ones clients can see.
const OPEN_MILESTONES_SQL = `
  FROM ${EFFECTIVE_MILESTONES_SQL} m
  JOIN projects p ON p.id = m.project_id AND p.team_id = $1
  JOIN project_client_settings pcs ON pcs.project_id = m.project_id AND pcs.portal_enabled IS TRUE
  LEFT JOIN clients c ON c.id = p.client_id
 WHERE m.target_date IS NOT NULL AND m.status <> 'completed'
`;

async function delayedMilestoneCount(q: Queryable, { teamId }: Ctx): Promise<number> {
  const result = await q.query(`SELECT COUNT(*)::int AS n ${OPEN_MILESTONES_SQL} AND ${MILESTONE_LATE_SQL}`, [teamId]);
  return result.rows[0]?.n ?? 0;
}

async function upcomingMilestones(q: Queryable, { teamId }: Ctx) {
  const result = await q.query(
    `SELECT m.id, m.project_id, m.name, m.target_date::text AS target_date, m.status,
            ${MILESTONE_LATE_SQL} AS is_late,
            p.name AS project_name, p.color_code AS project_color,
            COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS organization_name
       ${OPEN_MILESTONES_SQL}
      ORDER BY ${MILESTONE_LATE_SQL} DESC, m.target_date ASC, m.name
      LIMIT $2`,
    [teamId, MILESTONE_LIMIT]
  );
  return { items: result.rows };
}

async function overdueInvoices(q: Queryable, { teamId }: Ctx) {
  const result = await q.query(
    `SELECT COALESCE(NULLIF(i.currency, ''), 'USD') AS currency,
            COUNT(*)::int AS count,
            COALESCE(SUM(i.amount - COALESCE(i.paid_amount, 0)), 0)::float AS amount
       FROM client_portal_invoices i
      WHERE i.organization_team_id = $1 AND ${OVERDUE_SQL}
      GROUP BY 1 ORDER BY 2 DESC`,
    [teamId]
  );
  const by_currency = result.rows.map(r => ({ currency: r.currency, amount: r.amount }));
  return { count: result.rows.reduce((sum, r) => sum + r.count, 0), by_currency };
}

async function mentionsOfMe(q: Queryable, { teamId, userId }: Ctx) {
  const result = await q.query(
    `SELECT m.id, m.thread_id, m.author_name, m.body, m.created_at,
            th.project_id, p.name AS project_name,
            (m.created_at > COALESCE(r.last_read_at, '-infinity'::timestamptz)) AS unread
       FROM client_portal_thread_messages m
       JOIN client_portal_threads th ON th.id = m.thread_id AND th.organization_team_id = $1
       JOIN projects p ON p.id = th.project_id
       LEFT JOIN client_portal_thread_reads r ON r.thread_id = th.id AND r.user_id = $2
      WHERE $2 = ANY(m.mentioned_user_ids)
      ORDER BY (m.created_at > COALESCE(r.last_read_at, '-infinity'::timestamptz)) DESC, m.created_at DESC
      LIMIT $3`,
    [teamId, userId, LIST_LIMIT]
  );
  return {
    items: result.rows.map(row => ({
      id: row.id,
      thread_id: row.thread_id,
      author_name: row.author_name,
      excerpt: htmlToPlainText(row.body ?? "").slice(0, 160),
      at: row.created_at,
      project_id: row.project_id,
      project_name: row.project_name,
      unread: row.unread === true,
    })),
  };
}

async function changeRequestsByStatus(q: Queryable, { teamId }: Ctx) {
  const result = await q.query(
    `SELECT status, COUNT(*)::int AS count FROM client_portal_change_requests
      WHERE organization_team_id = $1 GROUP BY status`,
    [teamId]
  );
  return { items: result.rows as Array<{ status: string; count: number }> };
}

type AttentionKind = "approval_overdue" | "change_request_review" | "milestone_late";
interface AttentionItem {
  kind: AttentionKind;
  label: string;
  detail: string;
  at: string | null;
  target: { type: "approval" | "change_request" | "project"; id: string };
}

/** Workspace-wide "needs attention": the oldest overdue approvals, high-priority reviews and late milestones. */
async function needsAttention(q: Queryable, { teamId }: Ctx) {
  const [approvals, requests, milestones] = await Promise.all([
    q.query(
      `SELECT a.id, a.ref_no, a.title, a.due_date::text AS due_date,
              COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS organization_name
         FROM client_portal_approvals a JOIN clients c ON c.id = a.client_id
        WHERE a.organization_team_id = $1 AND a.status = 'awaiting' AND a.due_date < CURRENT_DATE
        ORDER BY a.due_date LIMIT $2`,
      [teamId, ATTENTION_LIMIT]
    ),
    q.query(
      `SELECT r.id, r.cr_no, r.title, r.submitted_at,
              COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS organization_name
         FROM client_portal_change_requests r JOIN clients c ON c.id = r.client_id
        WHERE r.organization_team_id = $1 AND r.status IN ('submitted', 'under_review') AND r.priority = 'high'
        ORDER BY r.submitted_at LIMIT $2`,
      [teamId, ATTENTION_LIMIT]
    ),
    q.query(
      `SELECT m.project_id, m.name, m.target_date::text AS target_date, p.name AS project_name
         ${OPEN_MILESTONES_SQL} AND ${MILESTONE_LATE_SQL}
        ORDER BY m.target_date LIMIT $2`,
      [teamId, ATTENTION_LIMIT]
    ),
  ]);

  const items: AttentionItem[] = [
    ...approvals.rows.map(
      (r): AttentionItem => ({
        kind: "approval_overdue",
        label: `${r.ref_no} ${r.title}`,
        detail: r.organization_name,
        at: r.due_date,
        target: { type: "approval", id: r.id },
      })
    ),
    ...requests.rows.map(
      (r): AttentionItem => ({
        kind: "change_request_review",
        label: `${r.cr_no} ${r.title}`,
        detail: r.organization_name,
        at: r.submitted_at,
        target: { type: "change_request", id: r.id },
      })
    ),
    ...milestones.rows.map(
      (r): AttentionItem => ({
        kind: "milestone_late",
        label: r.name,
        detail: r.project_name,
        at: r.target_date,
        target: { type: "project", id: r.project_id },
      })
    ),
  ];
  return { items: items.slice(0, ATTENTION_LIMIT * 2) };
}

const slimApproval = (a: any) => ({
  id: a.id,
  ref_no: a.ref_no,
  title: a.title,
  organization_name: a.organization_name,
  project_name: a.project_name,
  approver_name: a.approver_name,
  due_date: a.due_date,
  is_overdue: a.is_overdue,
});

const slimChangeRequest = (r: any) => ({
  id: r.id,
  cr_no: r.cr_no,
  title: r.title,
  organization_name: r.organization_name,
  project_name: r.project_name,
  priority: r.priority,
  status: r.status,
  submitted_at: r.submitted_at,
});

const slimThread = (t: any) => ({
  id: t.id,
  ref_no: t.ref_no,
  organization_name: t.organization_name,
  project_name: t.project_name,
  context_label: t.context.label,
  unread: t.unread,
  last_text: String(t.last_message.text ?? "").slice(0, 160),
  last_at: t.last_message.at,
});

const WIDGETS: Record<OverviewWidgetKey, (ctx: Ctx) => Promise<unknown>> = {
  kpi_awaiting_approvals: async ({ teamId }) => {
    const { awaiting, overdue } = await getApprovalStats(db, teamId);
    return { awaiting, overdue };
  },
  kpi_open_change_requests: async ({ teamId }) => {
    const { needs_review, waiting_on_client } = await getChangeRequestStats(db, teamId);
    return { needs_review, waiting_on_client };
  },
  kpi_delayed_milestones: async ctx => ({ delayed: await delayedMilestoneCount(db, ctx) }),
  kpi_unread_discussions: async ({ teamId, userId }) => ({ unread: await countUnreadThreads(db, teamId, userId) }),
  kpi_overdue_invoices: ctx => overdueInvoices(db, ctx),
  pending_approvals: async ({ teamId }) => {
    const list = await listApprovals(teamId, { status: "awaiting", sort: "due", order: "asc", limit: LIST_LIMIT });
    return { items: list.items.map(slimApproval), total: list.total };
  },
  change_requests: async ({ teamId }) => {
    const list = await listChangeRequests(teamId, {
      status: "submitted,under_review",
      sort: "submitted",
      order: "asc",
      limit: LIST_LIMIT,
    });
    return { items: list.items.map(slimChangeRequest), total: list.total };
  },
  upcoming_milestones: ctx => upcomingMilestones(db, ctx),
  latest_discussions: async ({ teamId, userId }) => {
    const list = await listThreads(teamId, userId, { limit: LIST_LIMIT });
    return { items: list.items.map(slimThread), total: list.total };
  },
  mentions_me: ctx => mentionsOfMe(db, ctx),
  approvals_by_status: async ({ teamId }) => {
    const { awaiting, approved, changes_requested } = await getApprovalStats(db, teamId);
    return { awaiting, approved, changes_requested };
  },
  cr_by_status: ctx => changeRequestsByStatus(db, ctx),
  needs_attention: ctx => needsAttention(db, ctx),
};

/** Parses `?widgets=a,b`: omitted means every widget; an unknown key is a 400. */
export function parseWidgetKeys(raw: string | undefined): OverviewWidgetKey[] {
  const requested = (raw ?? "")
    .split(",")
    .map(key => key.trim())
    .filter(Boolean);
  if (requested.length === 0) return [...OVERVIEW_WIDGET_KEYS];
  const unknown = requested.find(key => !isOverviewWidgetKey(key));
  if (unknown) throw badRequest(`Unknown widget: ${unknown}`, "INVALID_WIDGET");
  return Array.from(new Set(requested)) as OverviewWidgetKey[];
}

export async function getOverview(
  teamId: string,
  userId: string,
  keys: OverviewWidgetKey[]
): Promise<Record<string, OverviewWidgetResult>> {
  const ctx: Ctx = { teamId, userId };
  const entries = await Promise.all(
    keys.map(async (key): Promise<[string, OverviewWidgetResult]> => {
      try {
        return [key, { data: await WIDGETS[key](ctx) }];
      } catch (error) {
        console.error("Overview widget failed", { key, error });
        return [key, { error: "Failed to load this widget" }];
      }
    })
  );
  return Object.fromEntries(entries);
}
