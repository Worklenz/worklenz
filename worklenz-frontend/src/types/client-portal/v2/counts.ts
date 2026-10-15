/** Sidebar badges, derived from one query. */
export interface PortalCounts {
  /** Approvals awaiting a client decision. */
  awaiting_approvals: number;
  /** Change requests that need staff review (Submitted + Under Review). */
  review_change_requests: number;
  /** Discussion threads with unread client messages. */
  unread_threads: number;
}
