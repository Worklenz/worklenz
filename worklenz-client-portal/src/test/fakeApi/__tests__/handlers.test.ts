// TEST ONLY: pins the access rules the fake API mirrors from the backend, so pages are built against the real contract.
import { beforeEach, describe, expect, it } from 'vitest';
import { handleMockRequest } from '../handlers';
import { resetScenario, setScenario } from '../scenario';

const call = (method: string, path: string, body: Record<string, unknown> = {}, search = '') =>
  handleMockRequest(method, path, new URLSearchParams(search), body)!;
const bodyOf = (r: { body: unknown }) => (r.body as { body: any }).body;

describe('mock /v2 access rules', () => {
  beforeEach(() => resetScenario());

  it('shows only assigned projects', () => {
    setScenario({ userId: 'u-sam' });
    expect(bodyOf(call('GET', '/v2/projects')).map((p: any) => p.id)).toEqual(['p1']);
    expect(call('GET', '/v2/projects/p7').status).toBe(404);
  });

  it('returns 404, not 403, for an item staff made Internal Only, and drops it everywhere', () => {
    setScenario({ userId: 'u-alex', hiddenIds: ['t101'] });
    expect(bodyOf(call('GET', '/v2/projects/p1/tasks')).some((t: any) => t.id === 't101')).toBe(false);
    // its discussion thread is gone too
    expect(bodyOf(call('GET', '/v2/threads')).some((t: any) => t.id === 'th2')).toBe(false);
    expect(call('POST', '/v2/threads/comments', { thread_id: 'th2', text: 'hi' }).status).toBe(404);
    // a notification about it is not returned
    expect(bodyOf(call('GET', '/v2/notifications')).items.some((n: any) => n.id === 'n2')).toBe(false);
  });

  it('blocks a hidden file download with a 404', () => {
    setScenario({ userId: 'u-alex', hiddenIds: ['f2'] });
    expect(call('GET', '/v2/files/f2/access', {}, 'action=download').status).toBe(404);
  });

  it('marks an approval whose linked file was hidden as no longer shared, but keeps it listed', () => {
    setScenario({ userId: 'u-alex', hiddenIds: ['f2'] });
    const approval = bodyOf(call('GET', '/v2/approvals')).find((a: any) => a.id === 'ap123');
    expect(approval.linked_item.available).toBe(false);
  });

  it('answers 403 ACCESS_REVOKED for a revoked user on every route', () => {
    setScenario({ userId: 'u-alex', revokedUserIds: ['u-alex'] });
    const result = call('GET', '/v2/dashboard');
    expect(result.status).toBe(403);
    expect(bodyOf(result).code).toBe('ACCESS_REVOKED');
  });

  it('locks write actions for a Viewer', () => {
    setScenario({ userId: 'u-sam' });
    expect(call('POST', '/v2/threads/comments', { project_id: 'p1', context: { type: 'project' }, text: 'x' }).status).toBe(403);
    expect(call('POST', '/v2/change-requests', { project_id: 'p1', title: 't', description: 'd' }).status).toBe(403);
    expect(call('POST', '/v2/projects/p1/files/presign', { filename: 'a.txt', size: 10 }).status).toBe(403);
  });
});

describe('mock approval decisions', () => {
  beforeEach(() => resetScenario());

  it('lets only the named approver who is a Client Admin decide', () => {
    setScenario({ userId: 'u-jamie' });
    expect(call('POST', '/v2/approvals/ap123/decision', { outcome: 'approved' }).status).toBe(403);
    setScenario({ userId: 'u-alex' });
    expect(bodyOf(call('GET', '/v2/approvals')).find((a: any) => a.id === 'ap123').can_decide).toBe(true);
  });

  it('asks before recording changes requested with no comment, and records one decision only', () => {
    setScenario({ userId: 'u-alex' });
    const first = call('POST', '/v2/approvals/ap123/decision', { outcome: 'changes_requested', comment: '' });
    expect(first.status).toBe(400);
    expect(bodyOf(first).code).toBe('COMMENT_REQUIRED');

    expect(bodyOf(call('POST', '/v2/approvals/ap123/decision', { outcome: 'changes_requested', comment: '', confirm_empty: true })).recorded).toBe(true);
    // a double-click / second request records nothing more
    expect(bodyOf(call('POST', '/v2/approvals/ap123/decision', { outcome: 'approved' })).recorded).toBe(false);
    const detail = bodyOf(call('GET', '/v2/approvals/ap123'));
    expect(detail.status).toBe('changes_requested');
    expect(detail.history.length).toBe(2);
  });
});

describe('mock change requests', () => {
  beforeEach(() => resetScenario());

  it('moves More Information Required back to Under Review when the requester replies', () => {
    setScenario({ userId: 'u-jamie' });
    const before = bodyOf(call('GET', '/v2/change-requests/cr7'));
    expect(before.needs_your_reply).toBe(true);
    call('POST', '/v2/change-requests/cr7/replies', { text: 'Standard plan, no double opt-in.' });
    expect(bodyOf(call('GET', '/v2/change-requests/cr7')).status).toBe('under_review');
  });

  it('never shows an estimate it was not given', () => {
    setScenario({ userId: 'u-alex' });
    expect(bodyOf(call('GET', '/v2/change-requests/cr8')).estimate).toBeNull();
  });
});

describe('mock discussions', () => {
  beforeEach(() => resetScenario());

  it('tracks unread per user and clears it on read', () => {
    setScenario({ userId: 'u-alex' });
    expect(bodyOf(call('GET', '/v2/threads')).find((t: any) => t.id === 'th2').unread).toBe(false);
    expect(bodyOf(call('GET', '/v2/threads')).find((t: any) => t.id === 'th1').unread).toBe(true);
    call('POST', '/v2/threads/th1/read');
    expect(bodyOf(call('GET', '/v2/threads')).find((t: any) => t.id === 'th1').unread).toBe(false);
    setScenario({ userId: 'u-jamie' });
    expect(bodyOf(call('GET', '/v2/threads')).find((t: any) => t.id === 'th2').unread).toBe(true);
  });
});

describe('mock team switching', () => {
  beforeEach(() => resetScenario());

  it('lists every team for a multi-team login and marks the current one', () => {
    const teams = bodyOf(call('GET', '/organizations')).organizations;
    expect(teams.length).toBeGreaterThan(1);
    expect(teams.filter((t: any) => t.isCurrent)).toHaveLength(1);
  });

  it('lists only the default team for a single-team login', () => {
    setScenario({ multiTeam: false });
    expect(bodyOf(call('GET', '/organizations')).organizations).toHaveLength(1);
  });

  it('switches the team and the signed-in context follows', () => {
    const before = bodyOf(call('GET', '/v2/me')).operatorName;
    const res = call('POST', '/organizations/switch', { organizationId: 'org-northwind' });
    expect(res.status).toBe(200);
    expect(bodyOf(call('GET', '/v2/me')).operatorName).not.toBe(before);
    const current = bodyOf(call('GET', '/organizations')).organizations.find((t: any) => t.isCurrent);
    expect(current.teamId).toBe('org-northwind');
  });

  it('refuses a team the login does not belong to', () => {
    expect(call('POST', '/organizations/switch', { organizationId: 'org-unknown' }).status).toBe(403);
  });
});
