import { beforeEach, describe, expect, it } from 'vitest';
import { clearReturnTo, isSafeReturnPath, peekReturnTo, saveReturnTo } from '../returnTo';
import { targetPath, toProjectTab } from '../targets';

describe('return path', () => {
  beforeEach(() => sessionStorage.clear());

  it('remembers an in-app path until it is cleared', () => {
    saveReturnTo('/approvals/ap123?x=1');
    expect(peekReturnTo()).toBe('/approvals/ap123?x=1');
    clearReturnTo();
    expect(peekReturnTo()).toBeNull();
  });

  it('refuses anything that could leave the app or loop through sign-in', () => {
    ['//evil.example', 'https://evil.example', '/\\evil', '/auth/login', '/invite?token=x', '/access-removed', 'javascript:alert(1)'].forEach(path => {
      expect(isSafeReturnPath(path)).toBe(false);
      saveReturnTo(path);
      expect(peekReturnTo()).toBeNull();
    });
  });
});

describe('link targets', () => {
  it('builds the route for each kind of item', () => {
    expect(targetPath({ page: 'approval', id: 'a1' })).toBe('/approvals/a1');
    expect(targetPath({ page: 'change_request', id: 'c1' })).toBe('/change-requests/c1');
    expect(targetPath({ page: 'project', projectId: 'p1' })).toBe('/projects/p1');
    expect(targetPath({ page: 'milestone', projectId: 'p1', id: 'm1' })).toBe('/projects/p1/milestones?ms=m1');
    expect(targetPath({ page: 'task', projectId: 'p1', id: 't1' })).toBe('/projects/p1/tasks?task=t1');
    expect(targetPath({ page: 'file', projectId: 'p1', id: 'f1' })).toBe('/projects/p1/files?file=f1');
    expect(targetPath({ page: 'thread', projectId: 'p1', id: 'th1' })).toBe('/projects/p1/discussions?thread=th1');
  });

  it('opens Overview for an unknown project tab', () => {
    expect(toProjectTab('files')).toBe('files');
    expect(toProjectTab('nonsense')).toBe('overview');
    expect(toProjectTab(undefined)).toBe('overview');
  });
});
