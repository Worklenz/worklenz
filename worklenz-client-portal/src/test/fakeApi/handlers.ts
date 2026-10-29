// TEST ONLY (never imported by the app). A stateful in-memory stand-in for /api/client-portal/v2.
// Visibility, role and access rules mirror the backend's gating chain so the UI is built against
// the real contract: hidden items are 404 (never 403), a removed user is 403 ACCESS_REVOKED.
import {
  ACTIVITY, APPROVALS, ASSIGNMENTS, CHANGE_REQUESTS, FILES, INVOICES, MILESTONES, NOTIFICATIONS, MOCK_TEAMS, OPERATOR, ORG_NAME, PROJECTS,
  TASKS, THREADS, TIMEZONES, UPDATES, USERS, TODAY_ISO, nowIso,
  type MockApproval, type MockChangeRequest, type MockFile, type MockMessage, type MockNotification, type MockThread, type MockUser,
} from './fixtures';
import { getScenario, setScenario } from './scenario';
import type {
  ClientActivityV2, ClientApprovalDetailV2, ClientApprovalV2, ClientChangeRequestDetailV2, ClientChangeRequestV2, ClientDashboardV2,
  ClientFileV2, ClientMe, ClientMilestoneV2, ClientNotificationV2, ClientOrgUserV2, ClientProjectMembersV2, ClientProjectMemberV2, ClientProjectV2, ClientTaskV2,
  ClientThreadV2, ClientTarget, NotificationPrefs, NotificationType, ClientRole, DashboardLayoutV2,
} from '@/types/v2';

export interface MockResult {
  status: number;
  body: unknown;
}

// Responses are cloned: RTK Query freezes what it stores, and the mock must keep mutating its own state.
const ok = (body: unknown, message: string | null = null, status = 200): MockResult => ({
  status,
  body: { done: true, body: body === null || body === undefined ? null : JSON.parse(JSON.stringify(body)), message },
});
const fail = (status: number, code: string, message: string): MockResult => ({
  status,
  body: { done: false, body: { code }, message },
});
const notFound = (what = 'Item'): MockResult => fail(404, 'NOT_FOUND', `${what} not found`);

// ─── Mutable state (a deep copy so a page reload starts from the fixtures) ────────────────────
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const freshState = () => ({
  users: clone(USERS) as MockUser[],
  assignments: clone(ASSIGNMENTS) as Record<string, string[]>,
  files: clone(FILES) as MockFile[],
  threads: clone(THREADS) as MockThread[],
  approvals: clone(APPROVALS) as MockApproval[],
  crs: clone(CHANGE_REQUESTS) as MockChangeRequest[],
  notifications: clone(NOTIFICATIONS) as MockNotification[],
  pendingUploads: {} as Record<string, MockFile>,
  prefs: {} as Record<string, NotificationPrefs>,
  dashboardLayouts: {} as Record<string, DashboardLayoutV2>,
  seq: 100,
});
const state = freshState();
/** Tests only: put every fixture back the way it started. */
export const resetMockState = (): void => {
  Object.assign(state, freshState());
};
const nextId = (prefix: string): string => `${prefix}${++state.seq}`;

const ALL_TYPES: NotificationType[] = ['Approval', 'Comment', 'File', 'Milestone', 'Project', 'Change Request', 'Access'];

// ─── Subject + gating chain ───────────────────────────────────────────────────────────────────
interface Subject { user: MockUser; projectIds: string[] }

const subjectOrNull = (): Subject | null => {
  const sc = getScenario();
  const user = state.users.find(u => u.id === sc.userId);
  if (!user || sc.revokedUserIds.includes(user.id)) return null;
  const removed = sc.removedProjects[user.id] ?? [];
  // A Client Admin opens every project of the organization; Members and Viewers only their assigned ones.
  const projectIds = user.role === 'admin' ? PROJECTS.map(p => p.id) : (state.assignments[user.id] ?? []).filter(id => !removed.includes(id));
  return { user, projectIds };
};

const isHidden = (id: string): boolean => getScenario().hiddenIds.includes(id);
const visibleTask = (id: string): boolean => TASKS.some(t => t.id === id) && !isHidden(id);
const visibleFile = (id: string): boolean => state.files.some(f => f.id === id) && !isHidden(id);
const visibleMilestone = (id: string): boolean => MILESTONES.some(m => m.id === id) && !isHidden(id);

const can = (role: ClientRole) => ({
  comment: role !== 'viewer',
  upload: role !== 'viewer',
  submitChangeRequest: role !== 'viewer',
  approve: role === 'admin',
  manageUsers: role === 'admin',
});

const forbid = (): MockResult => fail(403, 'ROLE_FORBIDDEN', 'Your role cannot do this');
const projectName = (id: string): string => PROJECTS.find(p => p.id === id)?.name ?? '';

// ─── DTO builders ─────────────────────────────────────────────────────────────────────────────
const projectDto = (s: Subject, id: string): ClientProjectV2 | null => {
  const p = PROJECTS.find(x => x.id === id);
  if (!p || !s.projectIds.includes(id)) return null;
  const latest = UPDATES.filter(u => u.projectId === id)[0];
  return {
    id: p.id, name: p.name, status: p.status, phase: p.phase, progress: p.progress, start_date: p.start, expected_completion: p.due,
    primary_contact: p.contact.name, summary: p.summary,
    latest_update: latest ? { body: latest.body, published_at: latest.at } : null,
    shared_counts: {
      milestones: MILESTONES.filter(m => m.projectId === id && visibleMilestone(m.id)).length,
      tasks: TASKS.filter(t => t.projectId === id && visibleTask(t.id)).length,
      files: state.files.filter(f => f.projectId === id && visibleFile(f.id)).length,
    },
    allow_uploads: p.allowUploads && can(s.user.role).upload,
    open_approvals: state.approvals.filter(a => a.projectId === id && a.status === 'awaiting').length,
    open_change_requests: state.crs.filter(c => c.projectId === id && ['submitted', 'under_review', 'more_info'].includes(c.status)).length,
    contact_email: p.contact.email, contact_title: p.contact.title, color: p.color,
  };
};

const milestoneDto = (id: string): ClientMilestoneV2 => {
  const m = MILESTONES.find(x => x.id === id)!;
  return {
    id: m.id, name: m.name, description: m.description, target_date: m.target, status: m.status, completed_at: m.completed,
    completion_note: m.status === 'completed' ? m.completionNote : '', date_moved: m.status === 'delayed',
    linked_tasks: m.taskIds.filter(visibleTask).map(t => ({ id: t, title: TASKS.find(x => x.id === t)!.title })),
    linked_files: m.fileIds.filter(visibleFile).map(f => ({ id: f, name: state.files.find(x => x.id === f)!.name })),
  };
};

const taskDto = (id: string): ClientTaskV2 => {
  const t = TASKS.find(x => x.id === id)!;
  return {
    id: t.id, key: t.key, title: t.title, description: t.desc, status: t.status, due_date: t.due,
    attachments: t.fileIds.filter(visibleFile).map(f => {
      const file = state.files.find(x => x.id === f)!;
      return { id: file.id, name: file.name, version: file.version };
    }),
  };
};

const fileDto = (f: MockFile): ClientFileV2 => ({
  id: f.id, name: f.name, category: f.category, version: f.version, size_label: f.size, uploaded_at: f.date, source: f.side,
  uploaded_by: f.by, version_count: f.versions,
});

const linkAvailable = (a: MockApproval): boolean => {
  if (a.linked.type === 'file') return !!a.linked.id && visibleFile(a.linked.id);
  if (a.linked.type === 'milestone') return !!a.linked.id && visibleMilestone(a.linked.id);
  if (a.linked.type === 'task') return !!a.linked.id && visibleTask(a.linked.id);
  return true;
};

const approvalDto = (s: Subject, a: MockApproval): ClientApprovalV2 => {
  const approver = state.users.find(u => u.id === a.approverId);
  const file = a.linked.type === 'file' ? state.files.find(f => f.id === a.linked.id) : undefined;
  return {
    id: a.id, ref_no: a.refNo, project_id: a.projectId, project_name: projectName(a.projectId), title: a.title, status: a.status,
    revision: a.revision,
    linked_item: {
      type: a.linked.type, name: a.linked.name, task_key: a.linked.taskKey ?? null, file_version: a.linked.version,
      description: a.linked.type === 'freeform' ? a.linked.description ?? '' : null, available: linkAvailable(a), id: a.linked.id,
      current_file_version: file ? file.version : null,
    },
    instructions: a.instructions, due_date: a.due,
    is_overdue: a.status === 'awaiting' && !!a.due && a.due < TODAY_ISO(),
    can_decide: a.status === 'awaiting' && a.approverId === s.user.id && s.user.role === 'admin',
    decision: a.decision ? { outcome: a.decision.outcome, decided_by: a.decision.by, decided_at: a.decision.at, comment: a.decision.comment } : null,
    approver_name: approver?.name ?? '', requested_by: a.requestedBy,
    requested_at: a.history[0]?.at, updated_at: a.history[a.history.length - 1]?.at,
  };
};

const crDto = (s: Subject, c: MockChangeRequest): ClientChangeRequestV2 => ({
  id: c.id, cr_no: c.crNo, project_id: c.projectId, project_name: projectName(c.projectId), title: c.title, description: c.description,
  notes: c.notes, attachments: c.attachments, priority: c.priority, status: c.status, submitted_at: c.submitted, requester_name: c.requester,
  estimate: c.estimate, response: c.thread.filter(m => m.from === 'team').slice(-1)[0]?.text ?? '',
  needs_your_reply: c.status === 'more_info' && c.requesterId === s.user.id,
  updated_at: c.timeline[c.timeline.length - 1]?.at,
  closed_at: ['completed', 'rejected', 'cancelled'].includes(c.status) ? c.timeline[c.timeline.length - 1]?.at ?? null : null,
});

const threadVisible = (t: MockThread): boolean => {
  if (t.type === 'task') return !!t.refId && visibleTask(t.refId);
  if (t.type === 'file') return !!t.refId && visibleFile(t.refId);
  return true;
};

const threadRef = (t: MockThread): string => `DS-${String(state.threads.findIndex(x => x.id === t.id) + 1).padStart(6, '0')}`;

const threadDto = (s: Subject, t: MockThread): ClientThreadV2 => ({
  id: t.id, ref_no: threadRef(t), project_id: t.projectId, project_name: projectName(t.projectId),
  context: { type: t.type, label: t.label, ref_id: t.refId },
  messages: t.messages.map(m => ({
    id: m.id, author: m.author, side: m.side, mine: m.side === 'client' && m.author === s.user.name, visibility: m.visibility ?? 'client', text: m.text, at: m.at,
    mentions: [...m.text.matchAll(/@([A-Z][a-z]+ [A-Z][a-z]+)/g)].map(x => x[1]),
    attachments: (m.attachments ?? []).map(a => ({ id: a.id, file_id: a.id, name: a.name, type: a.name.split('.').pop()?.toLowerCase() ?? '', size: a.size })),
    reactions: (m.reactions ?? []).map(r => ({
      emoji: r.emoji,
      count: r.users.length,
      has_reacted: r.users.some(u => u.id === s.user.id),
      users: r.users,
    })),
  })),
  unread: !t.readBy.includes(s.user.id),
});

const myThreads = (s: Subject, projectId?: string | null): MockThread[] =>
  state.threads.filter(t => s.projectIds.includes(t.projectId) && (!projectId || t.projectId === projectId) && threadVisible(t));

const targetAvailable = (s: Subject, target: ClientTarget): boolean => {
  switch (target.page) {
    case 'approval': return state.approvals.some(a => a.id === target.id && s.projectIds.includes(a.projectId));
    case 'change_request': return state.crs.some(c => c.id === target.id && s.projectIds.includes(c.projectId));
    case 'project': return s.projectIds.includes(target.projectId);
    case 'milestone': return s.projectIds.includes(target.projectId) && visibleMilestone(target.id);
    case 'task': return s.projectIds.includes(target.projectId) && visibleTask(target.id);
    case 'file': return s.projectIds.includes(target.projectId) && visibleFile(target.id);
    case 'thread': {
      const t = state.threads.find(x => x.id === target.id);
      return !!t && s.projectIds.includes(t.projectId) && threadVisible(t);
    }
  }
};

const notificationsFor = (s: Subject): ClientNotificationV2[] => {
  const emailed = getScenario().emailedEventTypes;
  return state.notifications
    .filter(n => n.to.includes(s.user.id) && targetAvailable(s, n.target))
    .sort((a, b) => b.at.localeCompare(a.at))
    .map(n => ({
      id: n.id, type: n.type, title: n.title, body: n.body, at: n.at, unread: !n.readBy.includes(s.user.id),
      emailed: n.emailed && emailed.includes(n.type) && (state.prefs[s.user.id]?.[n.type] ?? true), target: n.target,
    }));
};

const prefsFor = (s: Subject): NotificationPrefs =>
  state.prefs[s.user.id] ?? (Object.fromEntries(ALL_TYPES.map(t => [t, false])) as NotificationPrefs);

const meDto = (s: Subject): ClientMe => {
  const sc = getScenario();
  return {
    id: s.user.id, name: s.user.name, email: s.user.email, jobTitle: s.user.jobTitle, role: s.user.role,
    organizationName: MOCK_TEAMS.find(team => team.id === sc.teamId)?.clientName ?? ORG_NAME,
    operatorName: MOCK_TEAMS.find(team => team.id === sc.teamId)?.name ?? OPERATOR, language: s.user.language, timezone: s.user.timezone, capabilities: can(s.user.role),
    invoicesVisible: sc.invoicesVisible, adminsCanInvite: sc.adminsCanInvite, adminsCanRemove: sc.adminsCanRemove,
    emailedEventTypes: sc.emailedEventTypes as NotificationType[],
  };
};

const dashboardDto = (s: Subject): ClientDashboardV2 => {
  const projects = s.projectIds.map(id => projectDto(s, id)).filter((p): p is ClientProjectV2 => !!p);
  const approvals = state.approvals.filter(a => s.projectIds.includes(a.projectId)).map(a => approvalDto(s, a));
  const crs = state.crs.filter(c => s.projectIds.includes(c.projectId)).map(c => crDto(s, c));
  const decidable = approvals.filter(a => a.can_decide);
  const waiting = crs.filter(c => c.needs_your_reply);
  const upcoming = projects
    .flatMap(p => MILESTONES.filter(m => m.projectId === p.id && m.status !== 'completed' && visibleMilestone(m.id)).map(m => ({ m, p })))
    .sort((a, b) => a.m.target.localeCompare(b.m.target))
    .slice(0, 5)
    .map(({ m, p }) => ({ id: m.id, name: m.name, project_id: p.id, project_name: p.name, target_date: m.target, status: m.status }));
  const recent: ClientActivityV2[] = ACTIVITY
    .filter(a => s.projectIds.includes(a.projectId) && (!a.ref || visibleFile(a.ref) || visibleMilestone(a.ref)))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6)
    .map(a => ({ id: a.id, kind: a.kind, text: a.text, at: a.at, target: a.target }));
  return {
    active_projects: projects.filter(p => p.status !== 'completed').length,
    pending_actions: decidable.length + waiting.length,
    upcoming_milestones: upcoming,
    needs_action: [
      ...decidable.map(a => ({ kind: 'approval' as const, id: a.id, ref_no: a.ref_no, title: a.title, project_name: a.project_name, due_date: a.due_date })),
      ...waiting.map(c => ({ kind: 'change_request' as const, id: c.id, ref_no: c.cr_no, title: c.title, project_name: c.project_name, due_date: null })),
    ],
    projects,
    waiting_on_others: approvals.filter(a => a.status === 'awaiting' && !a.can_decide).map(a => ({ id: a.id, ref_no: a.ref_no, title: a.title, waiting_for: a.approver_name ?? '' })),
    recent_activity: recent,
    unpaid_amount: getScenario().invoicesVisible ? INVOICES.filter(i => i.status !== 'Paid').reduce((sum, i) => sum + i.amount, 0) : undefined,
  };
};

// ─── Routing ──────────────────────────────────────────────────────────────────────────────────
type Ctx = { s: Subject; params: string[]; query: URLSearchParams; body: Record<string, any> };
type Handler = (ctx: Ctx) => MockResult;
const routes: Array<{ method: string; pattern: RegExp; handler: Handler }> = [];
const route = (method: string, pattern: string, handler: Handler) =>
  routes.push({ method, pattern: new RegExp(`^${pattern}$`), handler });

const ID = '([^/]+)';

// v1 endpoints the shell still calls (branding / session profile).
route('GET', '/organization-settings', () => ok({
  company_name: OPERATOR, contact_person: '', email: '', phone: '', address: '', logo_url: null,
  email_notifications: true, project_updates: true, invoice_notifications: true, request_updates: true,
  primary_color: '#1677ff', portal_title: getScenario().brandingSet ? `${OPERATOR} Project Hub` : null, portal_theme: 'light',
  visible_invoices: getScenario().invoicesVisible,
}));
route('GET', '/profile', ({ s }) => ok({ id: s.user.id, email: s.user.email, name: s.user.name, role: s.user.role, permissions: [], organizationId: getScenario().teamId }));

// Team switching: a multi-team login sees every team, a single-team login only the default one.
const teamsFor = () => {
  const sc = getScenario();
  return (sc.multiTeam ? MOCK_TEAMS : MOCK_TEAMS.slice(0, 1)).map((team, index) => ({
    id: `cuo-${team.id}`, name: team.name, portalTitle: team.portalTitle, clientName: team.clientName, teamId: team.id, clientId: team.clientId,
    isDefault: index === 0, isCurrent: team.id === sc.teamId,
  }));
};
route('GET', '/organizations', () => ok({ organizations: teamsFor() }));
// An invitation link opened while signed in: 'mock-invite' joins the next portal, 'mock-other-address' is for another email.
route('POST', '/organizations/accept-invite', ({ body }) => {
  if (body.inviteToken === 'mock-other-address') return fail(403, 'EMAIL_MISMATCH', 'This invitation was sent to a different email address than the one you are signed in with.');
  if (body.inviteToken !== 'mock-invite') return fail(404, 'LINK_INVALID', 'This link is no longer valid. Ask your project team for a new one.');
  const joined = MOCK_TEAMS[1];
  setScenario({ teamId: joined.id, multiTeam: true });
  return ok({ token: 'mock-client-token', organizationId: joined.id, clientId: joined.clientId, organizationName: joined.portalTitle, expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString() });
});
route('POST', '/organizations/switch', ({ body }) => {
  const target = teamsFor().find(team => team.teamId === body.organizationId);
  if (!target) return fail(403, 'FORBIDDEN', 'Access denied to this organization');
  setScenario({ teamId: target.teamId });
  return ok({ token: 'mock-client-token', organizationId: target.teamId, clientId: target.clientId, expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString() });
});

route('GET', '/v2/me', ({ s }) => ok(meDto(s)));
route('PUT', '/v2/me', ({ s, body }) => {
  if (typeof body.name === 'string' && !body.name.trim()) return fail(400, 'MISSING_FIELDS', 'Name is required');
  if (typeof body.name === 'string') s.user.name = body.name.trim();
  if (typeof body.job_title === 'string') s.user.jobTitle = body.job_title.trim();
  if (typeof body.language === 'string') s.user.language = body.language;
  if (body.timezone !== undefined) s.user.timezone = body.timezone;
  return ok(meDto(s), 'Saved');
});
route('POST', '/v2/me/account-deletion-request', ({ s }) => {
  if (s.user.role === 'admin') return fail(409, 'USE_DELETE', 'As a Client Admin you can delete your account yourself.');
  return ok({ sent: true }, 'Your request was sent');
});
route('POST', '/v2/me/account-deletion', ({ s, body }) => {
  if (s.user.role !== 'admin') return fail(403, 'ADMIN_ONLY', 'Only a Client Admin can delete an account here.');
  if (body.confirmation !== 'DELETE') return fail(400, 'INVALID_CONFIRMATION', 'Type DELETE to confirm');
  if (s.user.role === 'admin' && state.users.filter(u => u.role === 'admin').length <= 1) {
    return fail(409, 'LAST_ADMIN', 'You are the only Client Admin of your organization. Make another person a Client Admin before deleting your account.');
  }
  return ok({ scheduled_deletion_date: new Date(Date.now() + 30 * 86_400_000).toISOString() }, 'Account deletion request submitted');
});
route('GET', '/v2/timezones', () => ok(TIMEZONES));
route('GET', '/v2/me/dashboard-layout', ({ s }) => ok({ layout: state.dashboardLayouts[s.user.id] ?? null }));
route('PUT', '/v2/me/dashboard-layout', ({ s, body }) => {
  const layout = (body as { layout?: DashboardLayoutV2 }).layout;
  if (!layout || layout.version !== 1 || !Array.isArray(layout.widgets)) return fail(400, 'INVALID_LAYOUT', 'Invalid dashboard layout');
  state.dashboardLayouts[s.user.id] = layout;
  return ok({ layout }, 'Saved');
});
route('DELETE', '/v2/me/dashboard-layout', ({ s }) => {
  delete state.dashboardLayouts[s.user.id];
  return ok({ layout: null }, 'Reset');
});
route('GET', '/v2/me/notification-prefs', ({ s }) => ok(prefsFor(s)));
route('PUT', '/v2/me/notification-prefs', ({ s, body }) => {
  state.prefs[s.user.id] = { ...prefsFor(s), ...(body as Partial<NotificationPrefs>) };
  return ok(state.prefs[s.user.id]);
});

route('GET', '/v2/dashboard', ({ s }) => ok(dashboardDto(s)));
route('GET', '/v2/projects', ({ s, query }) => {
  const all = s.projectIds.map(id => projectDto(s, id)).filter((p): p is ClientProjectV2 => Boolean(p));
  if (!query.has('page') && !query.has('size')) return ok(all);
  const list = (key: string) => (query.get(key) ?? '').split(',').filter(Boolean);
  const [status, phase] = [list('status'), list('phase')];
  const search = (query.get('search') ?? '').trim().toLowerCase();
  const sort = ['name', 'status', 'phase', 'progress', 'expected_completion'].includes(query.get('sort') ?? '') ? (query.get('sort') as keyof ClientProjectV2) : 'name';
  const dir = query.get('order') === 'desc' ? -1 : 1;
  const rows = all
    .filter(p => (!status.length || status.includes(p.status)) && (!phase.length || (p.phase !== null && phase.includes(p.phase))))
    .filter(p => !search || [p.name, p.phase, p.primary_contact].some(v => (v ?? '').toLowerCase().includes(search)))
    .sort((a, b) => {
      const [l, r] = [a[sort], b[sort]];
      if (l === r) return 0;
      if (l === null || l === undefined) return 1;
      if (r === null || r === undefined) return -1;
      return (typeof l === 'number' && typeof r === 'number' ? l - r : String(l).localeCompare(String(r))) * dir;
    });
  const size = Number(query.get('size')) || 10;
  const page = Math.max(1, Number(query.get('page')) || 1);
  const phases = Array.from(new Set(all.map(p => p.phase).filter((v): v is string => Boolean(v)))).sort();
  return ok({ data: rows.slice((page - 1) * size, page * size), total: rows.length, phases });
});
const memberDto = (u: MockUser, viewerId: string): ClientProjectMemberV2 =>
  ({ id: u.id, name: u.name, email: u.email, jobTitle: u.jobTitle, role: u.role, isYou: u.id === viewerId, locked: u.role === 'admin' });
const membersDto = (s: Subject, projectId: string): ClientProjectMembersV2 => {
  const users = state.users.filter(u => u.status !== 'Deactivated');
  const isMember = (u: MockUser) => u.role === 'admin' || (state.assignments[u.id] ?? []).includes(projectId);
  return {
    members: users.filter(isMember).map(u => memberDto(u, s.user.id)),
    candidates: can(s.user.role).manageUsers ? users.filter(u => !isMember(u)).map(u => memberDto(u, s.user.id)) : [],
  };
};
route('GET', `/v2/projects/${ID}/members`, ({ s, params }) => (s.projectIds.includes(params[0]) ? ok(membersDto(s, params[0])) : notFound('Project')));
route('PUT', `/v2/projects/${ID}/members`, ({ s, params, body }) => {
  if (!can(s.user.role).manageUsers) return forbid();
  if (!s.projectIds.includes(params[0])) return notFound('Project');
  const [add, remove]: string[][] = [body.add, body.remove].map(v => (Array.isArray(v) ? v : []));
  for (const id of [...add, ...remove]) {
    const target = state.users.find(u => u.id === id);
    if (!target) return notFound('User');
    if (target.role === 'admin') return fail(409, 'ADMIN_HAS_ALL_PROJECTS', 'A Client Admin already opens every project of the organization.');
  }
  for (const id of add) state.assignments[id] = Array.from(new Set([...(state.assignments[id] ?? []), params[0]]));
  for (const id of remove.filter(id => !add.includes(id))) state.assignments[id] = (state.assignments[id] ?? []).filter(p => p !== params[0]);
  return ok(membersDto(s, params[0]), 'Saved');
});
route('GET', `/v2/projects/${ID}`, ({ s, params }) => {
  const dto = projectDto(s, params[0]);
  return dto ? ok(dto) : notFound('Project');
});
route('GET', `/v2/projects/${ID}/milestones`, ({ s, params }) =>
  s.projectIds.includes(params[0])
    ? ok(MILESTONES.filter(m => m.projectId === params[0] && visibleMilestone(m.id)).sort((a, b) => a.target.localeCompare(b.target)).map(m => milestoneDto(m.id)))
    : notFound('Project'));
route('GET', `/v2/projects/${ID}/tasks`, ({ s, params }) =>
  s.projectIds.includes(params[0]) ? ok(TASKS.filter(t => t.projectId === params[0] && visibleTask(t.id)).map(t => taskDto(t.id))) : notFound('Project'));
route('GET', `/v2/projects/${ID}/files`, ({ s, params }) =>
  s.projectIds.includes(params[0]) ? ok(state.files.filter(f => f.projectId === params[0] && visibleFile(f.id)).map(fileDto)) : notFound('Project'));

route('GET', `/v2/files/${ID}/access`, ({ s, params, query }) => {
  // Change request attachments are served by their own ids (cr…-attN).
  if (/-att\d+$/.test(params[0])) return ok({ url: `https://files.test/file/${params[0]}`, expires_in: 60, name: params[0], version: 1 });
  const file = state.files.find(f => f.id === params[0]);
  if (!file || !s.projectIds.includes(file.projectId) || isHidden(file.id)) return notFound('File');
  const action = query.get('action');
  if (action !== 'preview' && action !== 'download') return fail(400, 'INVALID_ACTION', 'action must be preview or download');
  return ok({ url: `https://files.test/file/${file.id}`, expires_in: 60, name: file.name, version: file.version });
});
route('POST', `/v2/projects/${ID}/files/presign`, ({ s, params, body }) => {
  const project = PROJECTS.find(p => p.id === params[0]);
  if (!project || !s.projectIds.includes(project.id)) return notFound('Project');
  if (!can(s.user.role).upload) return forbid();
  if (!project.allowUploads) return fail(400, 'UPLOADS_OFF', 'Uploads are turned off for this project');
  const id = nextId('f');
  state.pendingUploads[id] = {
    id, projectId: project.id, name: String(body.filename ?? 'file'), category: String(body.category ?? 'Supporting Document'), side: 'client',
    by: s.user.name, date: nowIso(), size: `${Math.max(1, Math.round(Number(body.size ?? 1024) / 1024))} KB`, version: 1, versions: 1,
  };
  return ok({ file_id: id, upload_url: `https://files.test/upload/${id}`, expires_in: 600 });
});
route('POST', `/v2/projects/${ID}/files/confirm`, ({ s, params, body }) => {
  const pending = state.pendingUploads[String(body.file_id)];
  if (!pending || pending.projectId !== params[0] || !s.projectIds.includes(params[0])) return notFound('File');
  delete state.pendingUploads[pending.id];
  state.files.unshift(pending);
  return ok(fileDto(pending), 'Uploaded', 201);
});

route('GET', '/v2/approvals', ({ s }) => ok(state.approvals.filter(a => s.projectIds.includes(a.projectId)).map(a => approvalDto(s, a))));
route('GET', `/v2/approvals/${ID}`, ({ s, params }) => {
  const a = state.approvals.find(x => x.id === params[0] && s.projectIds.includes(x.projectId));
  if (!a) return notFound('Approval');
  const detail: ClientApprovalDetailV2 = {
    ...approvalDto(s, a),
    history: [...a.history].sort((x, y) => y.at.localeCompare(x.at)),
    earlier_revisions: (a.linked.snapshots ?? []).slice(0, -1).reverse().map(sn => ({ revision: sn.rev, description: sn.description })),
  };
  return ok(detail);
});
route('POST', `/v2/approvals/${ID}/decision`, ({ s, params, body }) => {
  const a = state.approvals.find(x => x.id === params[0] && s.projectIds.includes(x.projectId));
  if (!a) return notFound('Approval');
  if (a.approverId !== s.user.id || s.user.role !== 'admin') return fail(403, 'NOT_THE_APPROVER', 'Only the named approver can decide');
  if (a.status !== 'awaiting') return ok({ recorded: false }, 'A decision was already recorded');
  const outcome = body.outcome;
  if (outcome !== 'approved' && outcome !== 'changes_requested') return fail(400, 'MISSING_FIELDS', 'outcome is required');
  const comment = String(body.comment ?? '').trim();
  if (outcome === 'changes_requested' && !comment && body.confirm_empty !== true) return fail(400, 'COMMENT_REQUIRED', 'Add a comment or confirm without one');
  const ref = a.linked.version ? `${a.linked.name} v${a.linked.version}` : `${a.linked.name}, revision ${a.revision}`;
  const at = nowIso();
  a.status = outcome;
  a.decision = { by: s.user.name, at, outcome, comment };
  a.history.push({ at, actor: s.user.name, text: `${outcome === 'approved' ? 'Approved' : 'Requested changes'}${comment ? `: “${comment}”` : ''} (${ref})` });
  return ok({ recorded: true }, 'Your decision was recorded');
});

route('GET', '/v2/change-requests', ({ s }) => ok(state.crs.filter(c => s.projectIds.includes(c.projectId)).map(c => crDto(s, c))));
route('GET', `/v2/change-requests/${ID}`, ({ s, params }) => {
  const c = state.crs.find(x => x.id === params[0] && s.projectIds.includes(x.projectId));
  if (!c) return notFound('Change request');
  const detail: ClientChangeRequestDetailV2 = {
    ...crDto(s, c),
    attachment_files: c.attachments.map((name, i) => ({ id: `${c.id}-att${i}`, name })),
    thread: c.thread, timeline: c.timeline,
    can_cancel: ['submitted', 'under_review', 'more_info'].includes(c.status) && can(s.user.role).submitChangeRequest && (c.requesterId === s.user.id || s.user.role === 'admin'),
  };
  return ok(detail);
});
route('POST', '/v2/change-requests', ({ s, body }) => {
  if (!can(s.user.role).submitChangeRequest) return forbid();
  const projectId = String(body.project_id ?? '');
  if (!s.projectIds.includes(projectId)) return notFound('Project');
  if (!String(body.title ?? '').trim() || !String(body.description ?? '').trim()) return fail(400, 'MISSING_FIELDS', 'Title and description are required');
  const n = Math.max(...state.crs.map(c => Number(c.crNo.slice(3)))) + 1;
  const created: MockChangeRequest = {
    id: nextId('cr'), crNo: `CR-${String(n).padStart(4, '0')}`, projectId, title: String(body.title).trim(), requesterId: s.user.id, requester: s.user.name,
    priority: body.priority ?? 'medium', submitted: nowIso(), status: 'submitted', description: String(body.description).trim(), notes: String(body.notes ?? '').trim(),
    attachments: ((body.attachment_file_ids as string[] | undefined) ?? []).map(id => state.files.find(f => f.id === id)?.name ?? 'attachment'),
    estimate: null, thread: [], timeline: [{ at: nowIso(), text: 'Submitted' }],
  };
  state.crs.unshift(created);
  return ok({ id: created.id, cr_no: created.crNo }, 'Change request submitted', 201);
});
route('POST', `/v2/change-requests/${ID}/replies`, ({ s, params, body }) => {
  if (!can(s.user.role).submitChangeRequest) return forbid();
  const c = state.crs.find(x => x.id === params[0] && s.projectIds.includes(x.projectId));
  if (!c) return notFound('Change request');
  if (['rejected', 'completed', 'cancelled'].includes(c.status)) return fail(409, 'REQUEST_CLOSED', 'This request is closed');
  const text = String(body.text ?? '').trim();
  if (!text) return fail(400, 'MISSING_FIELDS', 'Write a reply to send');
  const at = nowIso();
  c.thread.push({ from: 'client', author: s.user.name, text, at });
  if (c.status === 'more_info') {
    c.status = 'under_review';
    c.timeline.push({ at, text: 'Information provided' }, { at, text: 'Under review' });
  }
  return ok(null, 'Reply sent', 201);
});
route('POST', `/v2/change-requests/${ID}/cancel`, ({ s, params }) => {
  if (!can(s.user.role).submitChangeRequest) return forbid();
  const c = state.crs.find(x => x.id === params[0] && s.projectIds.includes(x.projectId));
  if (!c) return notFound('Change request');
  if (!['submitted', 'under_review', 'more_info'].includes(c.status)) return fail(409, 'REQUEST_CLOSED', 'This request can no longer be cancelled');
  if (c.requesterId !== s.user.id && s.user.role !== 'admin') return forbid();
  c.status = 'cancelled';
  c.timeline.push({ at: nowIso(), text: 'Cancelled' });
  return ok(null, 'Cancelled');
});

route('GET', '/v2/threads', ({ s, query }) => ok(myThreads(s, query.get('project_id')).sort((a, b) => (b.messages.slice(-1)[0]?.at ?? '').localeCompare(a.messages.slice(-1)[0]?.at ?? '')).map(t => threadDto(s, t))));
route('GET', `/v2/threads/${ID}`, ({ s, params }) => {
  const t = myThreads(s).find(x => x.id === params[0]);
  return t ? ok(threadDto(s, t)) : notFound('Discussion');
});
route('POST', `/v2/threads/${ID}/read`, ({ s, params }) => {
  const t = myThreads(s).find(x => x.id === params[0]);
  if (!t) return notFound('Discussion');
  if (!t.readBy.includes(s.user.id)) t.readBy.push(s.user.id);
  return ok(null);
});
route('POST', '/v2/threads/comments', ({ s, body }) => {
  if (!can(s.user.role).comment) return forbid();
  const text = String(body.text ?? '').trim();
  const attachmentIds = Array.isArray(body.attachment_file_ids) ? (body.attachment_file_ids as string[]) : [];
  if (!text && attachmentIds.length === 0) return fail(400, 'MISSING_FIELDS', 'Write a comment to send');
  let thread: MockThread | undefined;
  if (body.thread_id) {
    thread = myThreads(s).find(t => t.id === body.thread_id);
  } else {
    const projectId = String(body.project_id ?? '');
    if (!s.projectIds.includes(projectId)) return notFound('Project');
    const ctx = (body.context ?? { type: 'project' }) as { type: MockThread['type']; ref_id?: string | null };
    thread = state.threads.find(t => t.projectId === projectId && t.type === ctx.type && (t.refId ?? null) === (ctx.ref_id ?? null));
    if (!thread) {
      if (ctx.type === 'task' && !(ctx.ref_id && visibleTask(ctx.ref_id))) return notFound('Discussion');
      const label = ctx.type === 'task' ? `Task: ${TASKS.find(t => t.id === ctx.ref_id)?.title}`
        : ctx.type === 'approval' ? `Approval: ${state.approvals.find(a => a.id === ctx.ref_id)?.refNo}`
        : ctx.type === 'file' ? `File: ${state.files.find(f => f.id === ctx.ref_id)?.name}` : 'General';
      thread = { id: nextId('th'), projectId, type: ctx.type, refId: ctx.ref_id ?? null, label, readBy: [], messages: [] };
      state.threads.unshift(thread);
    }
    if (!threadVisible(thread)) return notFound('Discussion');
  }
  if (!thread) return notFound('Discussion');
  const attachments = attachmentIds.flatMap(id => {
    const file = state.files.find(f => f.id === id);
    return file ? [{ id: file.id, name: file.name, size: 1024 }] : [];
  });
  const visibility = body.visibility === 'client_only' ? 'client_only' : 'client';
  if (visibility === 'client_only' && (!body.thread_id || attachments.length > 0)) return fail(400, 'INVALID_VISIBILITY', 'Choose who can see this message');
  const message: MockMessage = { id: nextId('m'), author: s.user.name, side: 'client', text: text || '<p></p>', at: nowIso(), visibility, attachments };
  thread.messages.push(message);
  thread.readBy = [s.user.id];
  return ok({ thread_id: thread.id }, 'Comment sent', 201);
});

route('POST', `/v2/threads/messages/${ID}/reactions`, ({ s, params, body }) => {
  if (!can(s.user.role).comment) return forbid();
  const messageId = params[0];
  const emoji = String(body.emoji ?? '').trim();
  if (!emoji) return fail(400, 'INVALID_EMOJI', 'Please choose a valid emoji');

  let targetMsg: MockMessage | undefined;
  for (const t of myThreads(s)) {
    targetMsg = t.messages.find(m => m.id === messageId);
    if (targetMsg) break;
  }
  if (!targetMsg) return notFound('Message');
  if (targetMsg.deleted) return fail(400, 'MESSAGE_DELETED', 'Cannot react to a deleted message');

  targetMsg.reactions = targetMsg.reactions ?? [];
  let existing = targetMsg.reactions.find(r => r.emoji === emoji);
  if (existing) {
    const userIdx = existing.users.findIndex(u => u.id === s.user.id);
    if (userIdx >= 0) {
      existing.users.splice(userIdx, 1);
      if (existing.users.length === 0) {
        targetMsg.reactions = targetMsg.reactions.filter(r => r.emoji !== emoji);
      }
    } else {
      existing.users.push({ id: s.user.id, name: s.user.name, side: 'client' });
    }
  } else {
    targetMsg.reactions.push({
      emoji,
      users: [{ id: s.user.id, name: s.user.name, side: 'client' }],
    });
  }

  const result = targetMsg.reactions.map(r => ({
    emoji: r.emoji,
    count: r.users.length,
    has_reacted: r.users.some(u => u.id === s.user.id),
    users: r.users,
  }));
  return ok(result);
});

route('GET', `/v2/projects/${ID}/mention-options`, ({ s, params }) => {
  if (!s.projectIds.includes(params[0])) return notFound('Project');
  const onProject = (u: MockUser) => u.role === 'admin' || (state.assignments[u.id] ?? []).includes(params[0]);
  return ok(USERS.filter(u => u.id !== s.user.id && u.status === 'Active' && onProject(u)).map(u => ({ id: u.id, name: u.name })));
});

route('GET', '/v2/notifications', ({ s }) => {
  const items = notificationsFor(s);
  return ok({ items, unread_count: items.filter(n => n.unread).length });
});
route('PUT', '/v2/notifications/read-all', ({ s }) => {
  state.notifications.forEach(n => { if (n.to.includes(s.user.id) && !n.readBy.includes(s.user.id)) n.readBy.push(s.user.id); });
  return ok(null);
});
route('PUT', `/v2/notifications/${ID}/(read|unread)`, ({ s, params }) => {
  const n = state.notifications.find(x => x.id === params[0] && x.to.includes(s.user.id));
  if (!n) return notFound('Notification');
  n.readBy = params[1] === 'read' ? Array.from(new Set([...n.readBy, s.user.id])) : n.readBy.filter(u => u !== s.user.id);
  return ok(null);
});

route('GET', '/v2/organization/users', ({ s }) => {
  const list: ClientOrgUserV2[] = state.users.map(u => ({ id: u.id, name: u.name, email: u.email, jobTitle: u.jobTitle, role: u.role, status: u.status, isYou: u.id === s.user.id }));
  return ok(list);
});
route('POST', '/v2/organization/users/invite-link', ({ s, body }) => {
  const sc = getScenario();
  if (!can(s.user.role).manageUsers || !sc.adminsCanInvite) return forbid();
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail(400, 'INVALID_EMAIL', 'Enter a valid email address.');
  if (state.users.some(u => u.email === email)) return fail(409, 'ALREADY_EXISTS', 'That address already has access');
  state.users.push({ id: nextId('u'), name: email.split('@')[0], email, jobTitle: '', role: 'viewer', status: 'Invited', language: 'en', timezone: null });
  return ok({ link: `${window.location.origin}/invite?token=mock-${Date.now()}`, expires_in_days: 7, email, emailed: body.send_email === true }, 'Invite link created', 201);
});
route('PATCH', `/v2/organization/users/${ID}`, ({ s, params, body }) => {
  if (!can(s.user.role).manageUsers) return forbid();
  const target = state.users.find(u => u.id === params[0]);
  if (!target) return notFound('User');
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return fail(400, 'INVALID_NAME', 'Enter a name.');
    target.name = name;
  }
  if (typeof body.job_title === 'string') {
    target.jobTitle = body.job_title.trim();
  }
  if (body.role !== undefined) {
    if (!['admin', 'member', 'viewer'].includes(body.role)) return fail(400, 'INVALID_ROLE', 'Choose a valid role.');
    if (target.role === 'admin' && body.role !== 'admin' && state.users.filter(u => u.role === 'admin').length <= 1) return fail(409, 'LAST_ADMIN', 'An organization needs at least one Client Admin');
    target.role = body.role;
  }
  return ok({ id: target.id, name: target.name, email: target.email, jobTitle: target.jobTitle, role: target.role, status: target.status, isYou: target.id === s.user.id }, 'Saved');
});
route('GET', `/v2/organization/users/${ID}/projects`, ({ s, params }) => {
  if (!can(s.user.role).manageUsers) return forbid();
  const target = state.users.find(u => u.id === params[0]);
  if (!target) return notFound('User');
  const assigned = state.assignments[target.id] ?? [];
  return ok({ role: target.role, projects: PROJECTS.map(p => ({ id: p.id, name: p.name, assigned: assigned.includes(p.id) })) });
});
route('PUT', `/v2/organization/users/${ID}/projects`, ({ s, params, body }) => {
  if (!can(s.user.role).manageUsers) return forbid();
  const target = state.users.find(u => u.id === params[0]);
  if (!target) return notFound('User');
  if (target.role === 'admin') return fail(409, 'ADMIN_HAS_ALL_PROJECTS', 'A Client Admin already opens every project of the organization.');
  const ids: string[] = Array.isArray(body.project_ids) ? body.project_ids : [];
  if (ids.some(id => !PROJECTS.some(p => p.id === id))) return fail(400, 'INVALID_PROJECT', 'One or more projects are not available to assign');
  state.assignments[target.id] = Array.from(new Set(ids));
  return ok({ role: target.role, projects: PROJECTS.map(p => ({ id: p.id, name: p.name, assigned: ids.includes(p.id) })) }, 'Saved');
});
route('POST', `/v2/organization/users/${ID}/invite-link`, ({ s, params, body }) => {
  if (!can(s.user.role).manageUsers || !getScenario().adminsCanInvite) return forbid();
  const target = state.users.find(u => u.id === params[0]);
  if (!target) return notFound('User');
  if (target.status !== 'Invited') return fail(409, 'NOT_INVITED', 'This person has already joined.');
  return ok({ link: `${window.location.origin}/invite?token=mock-${Date.now()}`, expires_in_days: 7, email: target.email, emailed: body.send_email === true }, 'Invite link created', 201);
});
route('DELETE', `/v2/organization/users/${ID}`, ({ s, params }) => {
  const sc = getScenario();
  if (!can(s.user.role).manageUsers || !sc.adminsCanRemove) return forbid();
  const target = state.users.find(u => u.id === params[0]);
  if (!target) return notFound('User');
  if (target.id === s.user.id) return fail(409, 'CANNOT_REMOVE_SELF', 'You cannot remove yourself');
  if (target.role === 'admin' && state.users.filter(u => u.role === 'admin').length <= 1) return fail(409, 'LAST_ADMIN', 'An organization needs at least one Client Admin');
  state.users = state.users.filter(u => u.id !== target.id);
  return ok(null, 'Removed');
});

/** Resolve one request. `path` is relative to /api/client-portal (leading slash, no query). */
export const handleMockRequest = (method: string, path: string, query: URLSearchParams, body: Record<string, any>): MockResult | null => {
  const matched = routes.find(r => r.method === method && r.pattern.test(path));
  if (!matched) return null;
  const s = subjectOrNull();
  if (!s) return fail(403, 'ACCESS_REVOKED', 'Your access has been removed. Please contact your administrator.');
  const params = (path.match(matched.pattern) ?? []).slice(1);
  return matched.handler({ s, params, query, body });
};
