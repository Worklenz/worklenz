import { countUnreadThreads } from "./discussions.service";
import { Queryable } from "./types";

export interface PortalCounts {
  /** Approvals awaiting a client decision. */
  awaiting_approvals: number;
  /** Change requests that need staff review (Submitted + Under Review). */
  review_change_requests: number;
  /** Discussion threads with unread client messages for this staff user. */
  unread_threads: number;
}

/** The three sidebar badges, from one request. Unread is per staff user; the other two are workspace-wide. */
export async function getPortalCounts(q: Queryable, teamId: string, userId: string): Promise<PortalCounts> {
  const result = await q.query(
    `SELECT
       (SELECT COUNT(*)::int FROM client_portal_approvals a
         WHERE a.organization_team_id = $1 AND a.status = 'awaiting') AS awaiting_approvals,
       (SELECT COUNT(*)::int FROM client_portal_change_requests r
         WHERE r.organization_team_id = $1 AND r.status IN ('submitted', 'under_review')) AS review_change_requests`,
    [teamId]
  );
  const row = result.rows[0] ?? {};
  return {
    awaiting_approvals: row.awaiting_approvals ?? 0,
    review_change_requests: row.review_change_requests ?? 0,
    unread_threads: await countUnreadThreads(q, teamId, userId),
  };
}
