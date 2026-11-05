// TEST ONLY (never imported by the app). The Brandbase slice of the prototype: client-visible
// items only. Internal-only items, internal comments, assignees and draft approvals are not part of it.
import type {
  ClientRole,
  ChangeRequestPriority,
  ChangeRequestStatus,
  ApprovalStatus,
  ApprovalLinkType,
  MilestoneStatus,
  NotificationType,
  ProjectStatus,
  TaskStatus,
  ThreadContextType,
  ClientTarget,
} from '@/types/v2';

// The prototype's fixed "today" is 2026-06-02. Shift every date so the data reads the same
// relative to the real today (due in 2 days stays due in 2 days).
const PROTOTYPE_TODAY = Date.UTC(2026, 5, 2);
const DAY = 86_400_000;
const shiftMs = (): number => {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - PROTOTYPE_TODAY;
};
/** '2026-06-05' -> the same offset from today, as YYYY-MM-DD. */
export const rd = (iso: string | null): string | null => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + shiftMs()).toISOString().slice(0, 10);
};
/** '2026-06-01T16:10' -> shifted ISO timestamp. */
export const rt = (iso: string): string => {
  const [date, time = '09:00'] = iso.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) + shiftMs()).toISOString();
};
export const nowIso = (): string => new Date().toISOString();
export const TODAY_ISO = (): string => new Date(Date.UTC(2026, 5, 2) + shiftMs()).toISOString().slice(0, 10);
export { DAY };

export interface MockUser {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  role: ClientRole;
  status: 'Active' | 'Invited' | 'Deactivated';
  language: string;
  timezone: string | null;
}

export const OPERATOR = 'Ceydigital';
export const ORG_NAME = 'Brandbase';

/** The teams (workspaces) a multi-team login belongs to. The first is the default. */
export const MOCK_TEAMS: Array<{ id: string; name: string; portalTitle: string; clientName: string; clientId: string }> = [
  { id: 'org-brandbase', name: 'Ceydigital', portalTitle: 'Ceydigital Project Hub', clientName: ORG_NAME, clientId: 'client-brandbase' },
  { id: 'org-northwind', name: 'Northwind Studio', portalTitle: 'Northwind Client Portal', clientName: 'Northwind Retail', clientId: 'client-northwind' },
  { id: 'org-lumen', name: 'Lumen Agency', portalTitle: 'Lumen Agency', clientName: 'Lumen Health', clientId: 'client-lumen' },
];

export const USERS: MockUser[] = [
  { id: 'u-alex', name: 'Alex Chen', email: 'alex@brandbase.com', jobTitle: 'Creative Director', role: 'admin', status: 'Active', language: 'en', timezone: null },
  { id: 'u-jamie', name: 'Jamie Wu', email: 'jamie@brandbase.com', jobTitle: 'Marketing Manager', role: 'member', status: 'Active', language: 'en', timezone: null },
  { id: 'u-sam', name: 'Sam Okafor', email: 'sam@brandbase.com', jobTitle: 'Finance Lead', role: 'viewer', status: 'Active', language: 'en', timezone: null },
  { id: 'u-taylor', name: 'Taylor Reed', email: 'taylor@brandbase.com', jobTitle: '', role: 'member', status: 'Invited', language: 'en', timezone: null },
];

/** Which projects each user is assigned to. */
export const ASSIGNMENTS: Record<string, string[]> = {
  'u-alex': ['p1', 'p7'],
  'u-jamie': ['p1', 'p7'],
  'u-sam': ['p1'],
  'u-taylor': ['p7'],
};

export interface MockProject {
  id: string;
  name: string;
  color: string;
  status: ProjectStatus;
  phase: string;
  progress: number;
  start: string;
  due: string | null;
  allowUploads: boolean;
  contact: { name: string; title: string; email: string };
  summary: string;
}

export const PROJECTS: MockProject[] = [
  {
    id: 'p1', name: 'Brandbase Website Relaunch', color: '#ff4d4f', status: 'at_risk', phase: 'Development', progress: 54,
    start: rd('2026-03-03')!, due: rd('2026-07-08'), allowUploads: true,
    contact: { name: 'Kasun Fernando', title: 'Project Lead', email: 'kasun@ceydigital.com' },
    summary: 'A full redesign and relaunch of the Brandbase marketing site: new information architecture, visual design and a CMS your team can run without developers.',
  },
  {
    id: 'p7', name: 'Brandbase Q3 Content Refresh', color: '#722ed1', status: 'on_track', phase: 'Discovery', progress: 12,
    start: rd('2026-05-18')!, due: null, allowUploads: true,
    contact: { name: 'Priya R.', title: 'Content Lead', email: 'priya@ceydigital.com' },
    summary: 'Refreshing twelve key pages and a new editorial calendar for Q3.',
  },
];

export const UPDATES: Array<{ projectId: string; body: string; at: string }> = [
  { projectId: 'p1', at: rt('2026-05-29T10:00'), body: 'Homepage wireframe v3 is ready for your review. We have sent an approval request. The CMS build moved by a few days, but the launch date is unchanged.' },
  { projectId: 'p7', at: rt('2026-05-29T10:00'), body: 'Content audit is complete. The editorial calendar draft is with you for approval.' },
];

export interface MockMilestone {
  id: string; projectId: string; name: string; description: string; target: string; completed: string | null;
  status: MilestoneStatus; completionNote: string; taskIds: string[]; fileIds: string[];
}
const ms = (m: Omit<MockMilestone, 'target' | 'completed'> & { target: string; completed?: string | null }): MockMilestone => ({
  ...m, target: rd(m.target)!, completed: rd(m.completed ?? null),
});
export const MILESTONES: MockMilestone[] = [
  ms({ id: 'm1', projectId: 'p1', name: 'Discovery & brand audit', description: 'Stakeholder interviews and an audit of the current site.', target: '2026-03-20', completed: '2026-03-18', status: 'completed', completionNote: 'Audit findings were shared in the kickoff deck.', taskIds: ['t108'], fileIds: ['f4'] }),
  ms({ id: 'm2', projectId: 'p1', name: 'Site architecture & wireframes', description: 'Sitemap and page-level wireframes for your sign-off.', target: '2026-06-10', status: 'in_progress', completionNote: '', taskIds: ['t102'], fileIds: ['f2'] }),
  ms({ id: 'm3', projectId: 'p1', name: 'Visual design & design system', description: 'High-fidelity designs and a reusable component library.', target: '2026-06-24', status: 'upcoming', completionNote: '', taskIds: [], fileIds: ['f1'] }),
  ms({ id: 'm4', projectId: 'p1', name: 'Development & CMS build', description: 'Front-end build and CMS configuration.', target: '2026-06-30', status: 'delayed', completionNote: '', taskIds: [], fileIds: [] }),
  ms({ id: 'm5', projectId: 'p1', name: 'UAT & content migration', description: 'Your team tests the site while we migrate content.', target: '2026-07-03', status: 'upcoming', completionNote: '', taskIds: ['t106', 't107'], fileIds: [] }),
  ms({ id: 'm6', projectId: 'p1', name: 'Launch', description: 'Go-live and post-launch monitoring.', target: '2026-07-08', status: 'upcoming', completionNote: '', taskIds: [], fileIds: [] }),
  ms({ id: 'm8', projectId: 'p7', name: 'Content audit', description: 'Inventory and quality review of the twelve key pages.', target: '2026-05-30', completed: '2026-05-29', status: 'completed', completionNote: 'Audit complete: eight pages need rewrites, four need light edits.', taskIds: [], fileIds: [] }),
  ms({ id: 'm9', projectId: 'p7', name: 'Editorial calendar approved', description: 'Q3 calendar of articles and publishing dates.', target: '2026-06-12', status: 'in_progress', completionNote: '', taskIds: ['t109'], fileIds: ['f7'] }),
  ms({ id: 'm10', projectId: 'p7', name: 'First six articles published', description: 'First batch of articles live on the site.', target: '2026-06-30', status: 'upcoming', completionNote: '', taskIds: [], fileIds: [] }),
];

export interface MockTask {
  id: string; projectId: string; key: string; title: string; desc: string; status: TaskStatus; due: string | null; fileIds: string[];
}
const tk = (t: Omit<MockTask, 'due'> & { due: string | null }): MockTask => ({ ...t, due: rd(t.due) });
export const TASKS: MockTask[] = [
  tk({ id: 't101', projectId: 'p1', key: 'WL-224', title: 'Landing page copy', desc: 'Final copy for the homepage and the key landing pages.', status: 'in_progress', due: '2026-06-05', fileIds: ['f3'] }),
  tk({ id: 't102', projectId: 'p1', key: 'WL-225', title: 'Homepage wireframe (v3)', desc: 'Third round of the homepage wireframe, with your navigation feedback applied.', status: 'in_progress', due: '2026-06-04', fileIds: ['f2'] }),
  tk({ id: 't106', projectId: 'p1', key: 'WL-227', title: 'Homepage quality review', desc: 'We test the homepage across browsers and devices before it goes to UAT.', status: 'not_started', due: '2026-06-18', fileIds: [] }),
  tk({ id: 't107', projectId: 'p1', key: 'WL-228', title: 'Content migration plan', desc: 'Plan for moving your existing pages and posts into the new CMS.', status: 'not_started', due: '2026-06-12', fileIds: [] }),
  tk({ id: 't108', projectId: 'p1', key: 'WL-229', title: 'Kickoff workshop', desc: 'Half-day workshop to align on goals, audience and success measures.', status: 'done', due: '2026-05-06', fileIds: [] }),
  tk({ id: 't109', projectId: 'p7', key: 'WL-310', title: 'Q3 editorial calendar', desc: 'Calendar of articles and publishing dates for the quarter.', status: 'in_progress', due: '2026-06-05', fileIds: ['f7'] }),
];

export interface MockFile {
  id: string; projectId: string; name: string; category: string; side: 'team' | 'client'; by: string; date: string; size: string; version: number; versions: number;
}
const fl = (f: Omit<MockFile, 'date'> & { date: string }): MockFile => ({ ...f, date: rt(`${f.date}T09:00`) });
export const FILES: MockFile[] = [
  fl({ id: 'f1', projectId: 'p1', name: 'Brand Guidelines.pdf', category: 'Design', side: 'team', by: 'Thakshila F.', date: '2026-05-28', size: '2.6 MB', version: 3, versions: 3 }),
  fl({ id: 'f2', projectId: 'p1', name: 'Homepage Wireframe.fig', category: 'Design', side: 'team', by: 'Nimesh S.', date: '2026-06-01', size: '8.1 MB', version: 3, versions: 3 }),
  fl({ id: 'f3', projectId: 'p1', name: 'Website Requirements.docx', category: 'Requirements', side: 'client', by: 'Alex Chen', date: '2026-05-05', size: '184 KB', version: 1, versions: 1 }),
  fl({ id: 'f4', projectId: 'p1', name: 'Statement of Work.pdf', category: 'Agreement', side: 'team', by: 'Thakshila F.', date: '2026-03-04', size: '412 KB', version: 1, versions: 1 }),
  fl({ id: 'f7', projectId: 'p7', name: 'Q3 Editorial Calendar.xlsx', category: 'Deliverable', side: 'team', by: 'Priya R.', date: '2026-05-29', size: '74 KB', version: 2, versions: 2 }),
];

export interface MockMessage { id: string; author: string; side: 'client' | 'internal'; text: string; at: string; visibility?: 'client' | 'client_only'; attachments?: Array<{ id: string; name: string; size: number }>; reactions?: Array<{ emoji: string; users: Array<{ id: string; name: string; side: 'client' | 'internal' }> }>; deleted?: boolean }
export interface MockThread {
  id: string; projectId: string; type: ThreadContextType; refId: string | null; label: string; readBy: string[]; messages: MockMessage[];
}
const msg = (id: string, author: string, side: 'client' | 'internal', text: string, at: string): MockMessage => ({ id, author, side, text, at: rt(at) });
export const THREADS: MockThread[] = [
  { id: 'th1', projectId: 'p1', type: 'project', refId: null, label: 'General', readBy: ['u-jamie', 'u-sam'], messages: [
    msg('m1', 'Alex Chen', 'client', 'Hi team, can we confirm the launch date is still July 8?', '2026-06-01T09:12'),
    msg('m2', 'Kasun F.', 'internal', 'Yes, launch is still July 8. The CMS build moved by a few days, so we marked that milestone as delayed. Nothing changes for launch.', '2026-06-01T10:03'),
    msg('m4', 'Alex Chen', 'client', 'Thanks for the heads-up. Appreciate it.', '2026-06-01T10:40'),
    msg('m4b', 'Kasun F.', 'internal', '@Alex Chen the staging site is up if your team wants to click around before Friday.', '2026-06-02T08:30'),
  ] },
  { id: 'th2', projectId: 'p1', type: 'task', refId: 't101', label: 'Task: Landing page copy', readBy: ['u-alex'], messages: [
    msg('m5', 'Jamie Wu', 'client', 'Can the pricing page copy go into this batch too?', '2026-06-02T08:50'),
    msg('m6', 'Kasun F.', 'internal', 'Pricing copy sits outside this batch. If you want it included, please raise a change request and we will estimate it.', '2026-06-02T09:20'),
  ] },
  { id: 'th3', projectId: 'p1', type: 'approval', refId: 'ap123', label: 'Approval: AP-000123', readBy: ['u-alex', 'u-jamie', 'u-sam'], messages: [
    msg('m7', 'Kasun F.', 'internal', 'Wireframe v3 is ready. We applied your navigation feedback from round two.', '2026-06-01T16:12'),
    msg('m8', 'Alex Chen', 'client', 'Thanks, will review tomorrow morning.', '2026-06-01T17:01'),
  ] },
  { id: 'th4', projectId: 'p1', type: 'file', refId: 'f3', label: 'File: Website Requirements.docx', readBy: ['u-alex', 'u-jamie', 'u-sam'], messages: [
    msg('m9', 'Alex Chen', 'client', 'I uploaded the latest requirements, including the Spanish section we discussed.', '2026-05-05T15:30'),
    msg('m10', 'Kasun F.', 'internal', 'Got it, thank you. We will review it against the SOW.', '2026-05-05T16:15'),
  ] },
  { id: 'th5', projectId: 'p7', type: 'project', refId: null, label: 'General', readBy: ['u-alex', 'u-jamie'], messages: [
    msg('m11', 'Priya R.', 'internal', 'The editorial calendar draft is ready for approval. Let me know if you want to move any articles.', '2026-05-29T14:35'),
    msg('m12', 'Jamie Wu', 'client', 'Looking good. Alex will send consolidated feedback.', '2026-05-30T11:20'),
  ] },
];

export interface MockApproval {
  id: string; refNo: string; projectId: string; title: string; status: ApprovalStatus; revision: number;
  linked: { type: ApprovalLinkType; id: string | null; name: string; taskKey?: string; version: number | null; description?: string; snapshots?: Array<{ rev: number; description: string }> };
  approverId: string; instructions: string; due: string | null; requestedBy: string;
  decision: { by: string; at: string; outcome: string; comment: string } | null;
  history: Array<{ at: string; actor: string; text: string }>;
}
const ap = (a: Omit<MockApproval, 'due'> & { due: string | null }): MockApproval => ({ ...a, due: rd(a.due) });
export const APPROVALS: MockApproval[] = [
  ap({ id: 'ap123', refNo: 'AP-000123', projectId: 'p1', title: 'Approve homepage wireframe v3', status: 'awaiting', revision: 1,
    linked: { type: 'file', id: 'f2', name: 'Homepage Wireframe.fig', version: 3 }, approverId: 'u-alex',
    instructions: 'Please check the navigation labels and the order of the homepage sections. Comment on anything that looks off.', due: '2026-06-06', requestedBy: 'Kasun F.', decision: null,
    history: [{ at: rt('2026-06-01T16:10'), actor: 'Kasun F.', text: 'Requested approval of Homepage Wireframe v3' }] }),
  ap({ id: 'ap122', refNo: 'AP-000122', projectId: 'p1', title: 'Approve Brand Guidelines v2', status: 'approved', revision: 1,
    linked: { type: 'file', id: 'f1', name: 'Brand Guidelines.pdf', version: 2 }, approverId: 'u-alex',
    instructions: 'Confirm the colour palette and logo usage rules.', due: '2026-04-09', requestedBy: 'Kasun F.',
    decision: { by: 'Alex Chen', at: rt('2026-04-08T11:42'), outcome: 'approved', comment: 'Looks great. Approved.' },
    history: [{ at: rt('2026-04-02T15:05'), actor: 'Kasun F.', text: 'Requested approval of Brand Guidelines v2' }, { at: rt('2026-04-08T11:42'), actor: 'Alex Chen', text: 'Approved Brand Guidelines v2: “Looks great. Approved.”' }] }),
  ap({ id: 'ap121', refNo: 'AP-000121', projectId: 'p7', title: 'Approve Q3 editorial calendar', status: 'changes_requested', revision: 1,
    linked: { type: 'milestone', id: 'm9', name: 'Editorial calendar approved', version: null }, approverId: 'u-alex',
    instructions: 'Review the article order and publishing dates.', due: '2026-06-03', requestedBy: 'Priya R.',
    decision: { by: 'Alex Chen', at: rt('2026-05-31T09:20'), outcome: 'changes_requested', comment: 'Please move the pricing article before the case study and swap the dates for weeks 3 and 4.' },
    history: [{ at: rt('2026-05-29T14:30'), actor: 'Priya R.', text: 'Requested approval of Q3 editorial calendar' }, { at: rt('2026-05-31T09:20'), actor: 'Alex Chen', text: 'Requested changes: “Please move the pricing article before the case study and swap the dates for weeks 3 and 4.”' }] }),
  ap({ id: 'ap126', refNo: 'AP-000126', projectId: 'p1', title: 'Approve kickoff workshop outcomes', status: 'approved', revision: 1,
    linked: { type: 'task', id: 't108', name: 'Kickoff workshop', taskKey: 'WL-229', version: null }, approverId: 'u-alex',
    instructions: 'Confirm the goals and success measures we agreed in the workshop.', due: '2026-05-12', requestedBy: 'Kasun F.',
    decision: { by: 'Alex Chen', at: rt('2026-05-09T10:15'), outcome: 'approved', comment: 'Matches what we agreed.' },
    history: [{ at: rt('2026-05-07T14:00'), actor: 'Kasun F.', text: 'Requested approval of Kickoff workshop' }, { at: rt('2026-05-09T10:15'), actor: 'Alex Chen', text: 'Approved: “Matches what we agreed.” (Kickoff workshop, revision 1)' }] }),
  ap({ id: 'ap127', refNo: 'AP-000127', projectId: 'p1', title: 'Approve launch rollout approach', status: 'changes_requested', revision: 1,
    linked: { type: 'freeform', id: null, name: 'Launch rollout approach', version: null,
      description: 'Soft launch to your staff first, then the public launch one week later. Staging stays open for your testing in between.',
      snapshots: [{ rev: 1, description: 'Soft launch to your staff first, then the public launch one week later. Staging stays open for your testing in between.' }] },
    approverId: 'u-alex', instructions: 'Tell us if the one-week gap between the two launches works for your team.', due: '2026-06-05', requestedBy: 'Kasun F.',
    decision: { by: 'Alex Chen', at: rt('2026-06-01T09:40'), outcome: 'changes_requested', comment: 'Two weeks would suit our support team better.' },
    history: [{ at: rt('2026-05-29T11:00'), actor: 'Kasun F.', text: 'Requested approval of Launch rollout approach' }, { at: rt('2026-06-01T09:40'), actor: 'Alex Chen', text: 'Requested changes: “Two weeks would suit our support team better.” (Launch rollout approach, revision 1)' }] }),
];

export interface MockChangeRequest {
  id: string; crNo: string; projectId: string; title: string; requesterId: string; requester: string; priority: ChangeRequestPriority;
  submitted: string; status: ChangeRequestStatus; description: string; notes: string; attachments: string[];
  estimate: { hours: number | null; cost: number | null } | null;
  thread: Array<{ from: 'client' | 'team'; author: string; text: string; at: string }>;
  timeline: Array<{ at: string; text: string }>;
}
const cr = (c: Omit<MockChangeRequest, 'submitted'> & { submitted: string }): MockChangeRequest => ({ ...c, submitted: rt(`${c.submitted}T09:00`) });
export const CHANGE_REQUESTS: MockChangeRequest[] = [
  cr({ id: 'cr10', crNo: 'CR-0043', projectId: 'p1', title: 'Rebuild the site on a different CMS', requesterId: 'u-alex', requester: 'Alex Chen', priority: 'high', submitted: '2026-04-20', status: 'rejected',
    description: 'We are considering moving to a different CMS. Can the relaunch be built on it instead?', notes: '', attachments: [], estimate: null,
    thread: [{ from: 'team', author: 'Kasun F.', text: 'We cannot switch the CMS this late without moving the launch date by about eight weeks. We suggest revisiting after launch.', at: rt('2026-04-23T10:00') }],
    timeline: [{ at: rt('2026-04-20T09:00'), text: 'Submitted' }, { at: rt('2026-04-23T10:00'), text: 'Rejected' }] }),
  cr({ id: 'cr4', crNo: 'CR-0044', projectId: 'p1', title: 'Update footer legal links', requesterId: 'u-jamie', requester: 'Jamie Wu', priority: 'low', submitted: '2026-05-12', status: 'completed',
    description: 'Update the footer links to the new privacy and terms pages.', notes: '', attachments: [], estimate: { hours: 1, cost: 80 },
    thread: [{ from: 'team', author: 'Kavindu K.', text: 'Done and live on staging.', at: rt('2026-05-14T10:00') }],
    timeline: [{ at: rt('2026-05-12T09:00'), text: 'Submitted' }, { at: rt('2026-05-13T09:00'), text: 'Approved' }, { at: rt('2026-05-14T10:00'), text: 'Completed' }] }),
  cr({ id: 'cr5', crNo: 'CR-0045', projectId: 'p1', title: 'Extend blog template with author pages', requesterId: 'u-alex', requester: 'Alex Chen', priority: 'medium', submitted: '2026-05-15', status: 'in_progress',
    description: "We would like each article to link to an author page with a bio and the author's other posts.", notes: 'Authors: Alex, Jamie and two guest writers.', attachments: ['Author-page-sketch.png'], estimate: { hours: 16, cost: 1280 },
    thread: [{ from: 'team', author: 'Kasun F.', text: 'Approved. Work has started.', at: rt('2026-05-19T10:00') }],
    timeline: [{ at: rt('2026-05-15T09:00'), text: 'Submitted' }, { at: rt('2026-05-18T09:00'), text: 'Approved' }, { at: rt('2026-05-19T10:00'), text: 'In progress' }] }),
  cr({ id: 'cr6', crNo: 'CR-0046', projectId: 'p1', title: 'Add testimonials carousel to the homepage', requesterId: 'u-alex', requester: 'Alex Chen', priority: 'low', submitted: '2026-05-26', status: 'approved',
    description: 'A rotating carousel of customer testimonials on the homepage, below the hero.', notes: 'We will provide six quotes with logos.', attachments: [], estimate: { hours: 12, cost: 960 },
    thread: [{ from: 'team', author: 'Kasun F.', text: 'Approved. Estimated 12 hours. We will schedule it after the wireframe sign-off.', at: rt('2026-05-28T10:00') }],
    timeline: [{ at: rt('2026-05-26T09:00'), text: 'Submitted' }, { at: rt('2026-05-28T10:00'), text: 'Approved' }] }),
  cr({ id: 'cr7', crNo: 'CR-0047', projectId: 'p1', title: 'Integrate newsletter signup with Mailchimp', requesterId: 'u-jamie', requester: 'Jamie Wu', priority: 'medium', submitted: '2026-05-29', status: 'more_info',
    description: 'Add a newsletter signup form in the footer that sends subscribers to our Mailchimp audience.', notes: '', attachments: [], estimate: null,
    thread: [{ from: 'team', author: 'Kavindu K.', text: 'Which Mailchimp plan and audience will this connect to? And should we add a double opt-in step?', at: rt('2026-05-30T10:00') }],
    timeline: [{ at: rt('2026-05-29T09:00'), text: 'Submitted' }, { at: rt('2026-05-30T10:00'), text: 'More information requested' }] }),
  cr({ id: 'cr8', crNo: 'CR-0048', projectId: 'p1', title: 'Add a Spanish language version of the site', requesterId: 'u-alex', requester: 'Alex Chen', priority: 'high', submitted: '2026-06-01', status: 'under_review',
    description: 'We are opening a Spanish-speaking market in Q3. We need the full site available in Spanish, with a language switcher.', notes: 'Spanish copy will come from our agency in mid-June.', attachments: ['Spanish-copy-draft.docx'], estimate: null,
    thread: [], timeline: [{ at: rt('2026-06-01T09:00'), text: 'Submitted' }, { at: rt('2026-06-02T09:00'), text: 'Under review' }] }),
  cr({ id: 'cr9', crNo: 'CR-0049', projectId: 'p1', title: 'Add a cookie consent banner', requesterId: 'u-jamie', requester: 'Jamie Wu', priority: 'medium', submitted: '2026-06-02', status: 'submitted',
    description: 'Our legal team needs a cookie consent banner on the new site.', notes: '', attachments: [], estimate: null,
    thread: [], timeline: [{ at: rt('2026-06-02T09:00'), text: 'Submitted' }] }),
];

export interface MockNotification {
  id: string; type: NotificationType; title: string; body: string; at: string; to: string[]; emailed: boolean; target: ClientTarget; readBy: string[];
}
const nf = (n: Omit<MockNotification, 'at' | 'readBy'> & { at: string; unreadFor?: string[] }): MockNotification => {
  const { unreadFor = [], at, ...rest } = n;
  return { ...rest, at: rt(at), readBy: n.to.filter(u => !unreadFor.includes(u)) };
};
export const NOTIFICATIONS: MockNotification[] = [
  nf({ id: 'n1', type: 'Approval', title: 'New approval request', body: 'Approve homepage wireframe v3 · due Jun 6', at: '2026-06-01T16:10', to: ['u-alex', 'u-jamie', 'u-sam'], emailed: true, target: { page: 'approval', id: 'ap123' }, unreadFor: ['u-alex', 'u-jamie', 'u-sam'] }),
  nf({ id: 'n2', type: 'Comment', title: 'Kasun F. replied on Landing page copy', body: 'Pricing copy sits outside this batch. If you want it included…', at: '2026-06-02T09:20', to: ['u-alex', 'u-jamie'], emailed: true, target: { page: 'thread', projectId: 'p1', id: 'th2' }, unreadFor: ['u-alex', 'u-jamie'] }),
  nf({ id: 'n3', type: 'Change Request', title: 'CR-0047 needs more information', body: 'The team asked a question about Mailchimp.', at: '2026-05-30T15:10', to: ['u-alex', 'u-jamie'], emailed: true, target: { page: 'change_request', id: 'cr7' }, unreadFor: ['u-alex', 'u-jamie'] }),
  nf({ id: 'n4', type: 'File', title: 'New file shared', body: 'Homepage Wireframe.fig (v3) in Brandbase Website Relaunch', at: '2026-06-01T15:58', to: ['u-alex', 'u-jamie', 'u-sam'], emailed: false, target: { page: 'file', projectId: 'p1', id: 'f2' } }),
  nf({ id: 'n5', type: 'Milestone', title: 'Milestone is now Delayed', body: 'Development & CMS build · new target Jun 30', at: '2026-05-28T11:05', to: ['u-alex', 'u-jamie', 'u-sam'], emailed: false, target: { page: 'milestone', projectId: 'p1', id: 'm4' } }),
  nf({ id: 'n6', type: 'Project', title: 'Project update from Kasun F.', body: 'Homepage wireframe v3 is ready for your review.', at: '2026-05-29T17:00', to: ['u-alex', 'u-jamie', 'u-sam'], emailed: false, target: { page: 'project', projectId: 'p1' } }),
  nf({ id: 'n8', type: 'Comment', title: 'Kasun F. mentioned you in General', body: '@Alex Chen the staging site is up if your team wants to click around…', at: '2026-06-02T08:30', to: ['u-alex'], emailed: true, target: { page: 'thread', projectId: 'p1', id: 'th1' }, unreadFor: ['u-alex'] }),
  nf({ id: 'n7', type: 'Access', title: 'You now have access to a project', body: 'Brandbase Q3 Content Refresh', at: '2026-05-12T10:00', to: ['u-alex', 'u-jamie'], emailed: true, target: { page: 'project', projectId: 'p7' } }),
];

export const ACTIVITY: Array<{ id: string; projectId: string; kind: 'approval' | 'file' | 'project' | 'milestone'; text: string; at: string; target: ClientTarget; ref?: string }> = [
  { id: 'ac1', projectId: 'p1', kind: 'approval', text: 'Kasun F. requested your approval: Approve homepage wireframe v3', at: rt('2026-06-01T16:10'), target: { page: 'approval', id: 'ap123' } },
  { id: 'ac2', projectId: 'p1', kind: 'file', text: 'Nimesh S. shared Homepage Wireframe.fig (v3)', at: rt('2026-06-01T15:58'), target: { page: 'file', projectId: 'p1', id: 'f2' }, ref: 'f2' },
  { id: 'ac3', projectId: 'p1', kind: 'project', text: 'Kasun F. posted a project update', at: rt('2026-05-29T10:00'), target: { page: 'project', projectId: 'p1' } },
  { id: 'ac4', projectId: 'p7', kind: 'milestone', text: 'Milestone completed: Content audit', at: rt('2026-05-29T09:00'), target: { page: 'milestone', projectId: 'p7', id: 'm8' }, ref: 'm8' },
  { id: 'ac5', projectId: 'p1', kind: 'milestone', text: 'Development & CMS build is now Delayed', at: rt('2026-05-28T11:00'), target: { page: 'milestone', projectId: 'p1', id: 'm4' }, ref: 'm4' },
  { id: 'ac6', projectId: 'p1', kind: 'file', text: 'Thakshila F. shared Brand Guidelines.pdf (v3)', at: rt('2026-05-28T09:00'), target: { page: 'file', projectId: 'p1', id: 'f1' }, ref: 'f1' },
];

export const INVOICES = [
  { id: 'inv-042', number: 'INV-042', amount: 12600, status: 'Paid', issued: rt('2026-05-01T09:00'), due: rt('2026-05-15T09:00') },
];

export const TIMEZONES = [
  { id: 'UTC', name: 'UTC', abbrev: 'UTC' },
  { id: 'America/New_York', name: 'America/New_York', abbrev: 'EST' },
  { id: 'America/Los_Angeles', name: 'America/Los_Angeles', abbrev: 'PST' },
  { id: 'Europe/London', name: 'Europe/London', abbrev: 'GMT' },
  { id: 'Europe/Berlin', name: 'Europe/Berlin', abbrev: 'CET' },
  { id: 'Asia/Colombo', name: 'Asia/Colombo', abbrev: '+0530' },
  { id: 'Australia/Sydney', name: 'Australia/Sydney', abbrev: 'AEST' },
];
