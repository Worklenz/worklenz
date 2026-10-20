import {
  buildDefaultStatusMap,
  resolveReachedEvent,
  resolveTargetStatus,
  GithubStatusMap,
} from '../services/github/github-transition-rules';

const state = (overrides: Partial<Parameters<typeof resolveReachedEvent>[0]> = {}) => ({
  closingPullRequests: [],
  openPullRequests: 0,
  draftPullRequests: 0,
  activeBranches: 0,
  ...overrides,
});

describe('resolveReachedEvent', () => {
  it('returns null with no Git activity', () => {
    expect(resolveReachedEvent(state())).toBeNull();
  });

  it('reaches branch_created from a branch or draft PR', () => {
    expect(resolveReachedEvent(state({ activeBranches: 1 }))).toBe('branch_created');
    expect(resolveReachedEvent(state({ draftPullRequests: 1 }))).toBe('branch_created');
  });

  it('reaches pr_opened with an open non-draft PR', () => {
    expect(resolveReachedEvent(state({ activeBranches: 1, openPullRequests: 1 }))).toBe('pr_opened');
  });

  it('reaches pr_merged only when all closing PRs are merged', () => {
    expect(
      resolveReachedEvent(state({ closingPullRequests: [{ merged: true }, { merged: false }], openPullRequests: 1 }))
    ).toBe('pr_opened');
    expect(
      resolveReachedEvent(state({ closingPullRequests: [{ merged: true }, { merged: true }] }))
    ).toBe('pr_merged');
  });

  it('does not treat a merged non-closing PR as done', () => {
    expect(resolveReachedEvent(state({ activeBranches: 1 }))).toBe('branch_created');
  });
});

describe('resolveTargetStatus', () => {
  const map: GithubStatusMap = { branch_created: 'doing', pr_opened: 'review', pr_merged: 'done' };
  const isDone = (id: string) => id === 'done';
  const base = { statusMap: map, isDoneStatus: isDone };

  it('moves forward to the mapped status', () => {
    expect(
      resolveTargetStatus({ ...base, event: 'branch_created', currentStatusId: 'todo', currentStatusIsDone: false })
    ).toBe('doing');
  });

  it('does nothing when no mapping is configured for the event', () => {
    expect(
      resolveTargetStatus({
        ...base,
        statusMap: { pr_merged: 'done' },
        event: 'branch_created',
        currentStatusId: 'todo',
        currentStatusIsDone: false,
      })
    ).toBeNull();
  });

  it('never moves backwards to an earlier event status', () => {
    expect(
      resolveTargetStatus({ ...base, event: 'branch_created', currentStatusId: 'review', currentStatusIsDone: false })
    ).toBeNull();
    expect(
      resolveTargetStatus({ ...base, event: 'pr_opened', currentStatusId: 'done', currentStatusIsDone: true })
    ).toBeNull();
  });

  it('does not reopen a finished issue', () => {
    expect(
      resolveTargetStatus({ ...base, event: 'branch_created', currentStatusId: 'shipped', currentStatusIsDone: true })
    ).toBeNull();
  });

  it('is a no-op when already at the target', () => {
    expect(
      resolveTargetStatus({ ...base, event: 'pr_opened', currentStatusId: 'review', currentStatusIsDone: false })
    ).toBeNull();
  });

  it('allows moving to done from review', () => {
    expect(
      resolveTargetStatus({ ...base, event: 'pr_merged', currentStatusId: 'review', currentStatusIsDone: false })
    ).toBe('done');
  });
});

describe('buildDefaultStatusMap', () => {
  const status = (id: string, name: string, kind: 'todo' | 'doing' | 'done') => ({
    id,
    name,
    is_todo: kind === 'todo',
    is_doing: kind === 'doing',
    is_done: kind === 'done',
  });

  it('maps by category and finds a review column by name', () => {
    expect(
      buildDefaultStatusMap([
        status('1', 'Backlog', 'todo'),
        status('2', 'In Progress', 'doing'),
        status('3', 'In Review', 'doing'),
        status('4', 'Done', 'done'),
      ])
    ).toEqual({ branch_created: '2', pr_opened: '3', pr_merged: '4' });
  });

  it('leaves pr_opened unset when there is no review status', () => {
    expect(
      buildDefaultStatusMap([
        status('1', 'To Do', 'todo'),
        status('2', 'Doing', 'doing'),
        status('3', 'Finished', 'done'),
      ])
    ).toEqual({ branch_created: '2', pr_opened: null, pr_merged: '3' });
  });
});
