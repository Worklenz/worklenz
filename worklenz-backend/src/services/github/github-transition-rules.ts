export type GithubTransitionEvent = "branch_created" | "pr_opened" | "pr_merged";

/** Per-repository mapping from a Git event to the project status the issue should move to. */
export type GithubStatusMap = Partial<Record<GithubTransitionEvent, string | null>>;

export interface ITaskGitState {
  /** Pull requests that reference the issue with a closing keyword. */
  closingPullRequests: Array<{ merged: boolean }>;
  /** Open, non-draft pull requests (closing or not). */
  openPullRequests: number;
  /** Open draft pull requests. */
  draftPullRequests: number;
  /** Branches for the issue that still exist. */
  activeBranches: number;
}

const EVENT_RANK: Record<GithubTransitionEvent, number> = {
  branch_created: 1,
  pr_opened: 2,
  pr_merged: 3,
};

export const GITHUB_TRANSITION_EVENTS = Object.keys(EVENT_RANK) as GithubTransitionEvent[];

/**
 * The furthest lifecycle event the issue has reached, derived from stored Git state rather
 * than from the webhook that happened to arrive, so out-of-order deliveries converge.
 */
export function resolveReachedEvent(state: ITaskGitState): GithubTransitionEvent | null {
  if (state.closingPullRequests.length > 0 && state.closingPullRequests.every(pr => pr.merged)) {
    return "pr_merged";
  }
  if (state.openPullRequests > 0) return "pr_opened";
  if (state.activeBranches > 0 || state.draftPullRequests > 0) return "branch_created";
  return null;
}

export interface ITransitionInput {
  event: GithubTransitionEvent | null;
  statusMap: GithubStatusMap;
  currentStatusId: string;
  currentStatusIsDone: boolean;
  /** Whether each mapped target status is in a done category. */
  isDoneStatus: (statusId: string) => boolean;
}

/**
 * Returns the status id to move to, or null to leave the issue alone.
 * Conservative by design: never moves backwards, never reopens a finished issue, and does not
 * touch an issue that is already at (or beyond) the mapped status for this or a later event.
 */
export function resolveTargetStatus(input: ITransitionInput): string | null {
  const { event, statusMap, currentStatusId, currentStatusIsDone, isDoneStatus } = input;
  if (!event) return null;

  const target = statusMap[event];
  if (!target || target === currentStatusId) return null;

  // Already sitting at the status of a later lifecycle event.
  for (const other of GITHUB_TRANSITION_EVENTS) {
    if (EVENT_RANK[other] > EVENT_RANK[event] && statusMap[other] === currentStatusId) return null;
  }

  // Do not reopen finished issues unless the target is itself a done status.
  if (currentStatusIsDone && !isDoneStatus(target)) return null;

  return target;
}

export interface IProjectStatusOption {
  id: string;
  name: string;
  is_todo: boolean;
  is_doing: boolean;
  is_done: boolean;
}

/**
 * Sensible starting mapping for a project, derived from status categories (statuses are
 * user-editable, so names are only used to spot a "review" column). Expects statuses in
 * display order.
 */
export function buildDefaultStatusMap(statuses: IProjectStatusOption[]): GithubStatusMap {
  const doing = statuses.filter(s => s.is_doing);
  const review = doing.find(s => /review/i.test(s.name));
  const progress = doing.find(s => s.id !== review?.id) ?? doing[0];
  const done = statuses.find(s => s.is_done);

  return {
    branch_created: progress?.id ?? null,
    pr_opened: review?.id ?? null,
    pr_merged: done?.id ?? null,
  };
}
