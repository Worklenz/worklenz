jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), pool: { connect: jest.fn() } },
}));
jest.mock("../shared/email", () => ({ __esModule: true, sendEmail: jest.fn(), sendEmailEnhanced: jest.fn(), EmailRequest: jest.fn() }));
jest.mock("../cron_jobs/helpers", () => ({ __esModule: true, getClientPortalBaseUrl: () => "https://portal.test" }));

import {
  getClientDashboard,
  listClientApprovals,
  listClientChangeRequests,
  listClientMilestones,
  listClientProjects,
  listClientTasks,
} from "../services/client-portal-v2/client-read.service";
import { PortalError } from "../services/client-portal-v2/errors";
import { assertSubjectProject, fileClientVisibleSql, taskClientVisibleSql } from "../services/client-portal-v2/scope";
import type { ClientSubject } from "../services/client-portal-v2/subject";
import { createQueryResult } from "./utils/db-mock";

const subject = (role: ClientSubject["role"] = "admin"): ClientSubject => ({
  contactId: "contact-1",
  clientId: "client-1",
  teamId: "team-1",
  role,
  name: "Alex Chen",
  email: "alex@brandbase.com",
  clientUserId: "login-1",
});

type Handler = [RegExp, any];

/** A fake pg connection that routes by SQL text. Anything unlisted returns no rows. */
const fakeDb = (handlers: Handler[]) => {
  const query = jest.fn(async (sql: string) => {
    const match = handlers.find(([pattern]) => pattern.test(sql));
    if (!match) return createQueryResult([]);
    return typeof match[1] === "function" ? match[1]() : match[1];
  });
  return { query, calls: () => query.mock.calls.map(([sql]) => String(sql)) };
};

// The subject can open exactly this project (assigned, portal on).
const PROJECT_ROW = [/FROM projects p\s+JOIN project_client_settings/, createQueryResult([{ id: "project-1" }])] as Handler;

describe("project scope", () => {
  it("answers 404 for a project the user is not assigned to, never 403", async () => {
    const db = fakeDb([]);
    await expect(assertSubjectProject(db, subject(), "project-9")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
  });

  it("lets the subject open an assigned project with the portal on", async () => {
    const db = fakeDb([PROJECT_ROW]);
    await expect(assertSubjectProject(db, subject(), "project-1")).resolves.toBeUndefined();
  });

  it("builds the gating chain: assigned AND portal on AND same organization AND same team", async () => {
    const db = fakeDb([PROJECT_ROW]);
    await assertSubjectProject(db, subject(), "project-1");
    const sql = db.calls()[0];
    expect(sql).toMatch(/client_contact_project_access/);
    expect(sql).toMatch(/adm.role = 'admin'/);
    expect(sql).toMatch(/portal_enabled IS TRUE/);
    expect(sql).toMatch(/p\.client_id = \$2/);
    expect(sql).toMatch(/p\.team_id = \$3/);
  });

  it("shares an item only when its own visibility says so", () => {
    expect(taskClientVisibleSql("t")).toMatch(/visibility = 'client'/);
    expect(taskClientVisibleSql("t")).toMatch(/archived IS FALSE/);
    expect(fileClientVisibleSql("pf")).toMatch(/portal_visibility = 'client'/);
    expect(fileClientVisibleSql("pf")).toMatch(/status = 'active'/);
  });

  it("returns an empty list, with no further queries, for a user with no accessible projects", async () => {
    const db = fakeDb([]);
    expect(await listClientProjects(db, subject())).toEqual([]);
    expect(await listClientApprovals(db, subject())).toEqual([]);
    expect(await listClientChangeRequests(db, subject())).toEqual([]);
    // Only the project-scope lookup ran; nothing else was read.
    expect(db.calls().every(sql => /client_contact_project_access/.test(sql))).toBe(true);
  });
});

describe("client payloads are allow-lists", () => {
  it("never returns a milestone's internal note, even if the row carries it", async () => {
    const db = fakeDb([
      PROJECT_ROW,
      [
        /FROM client_portal_milestones m/,
        createQueryResult([
          {
            id: "m1",
            name: "Development & CMS build",
            description: "Front-end build.",
            target_date: "2026-06-30",
            status: "delayed",
            completed_at: null,
            completion_note: "should not show for a non-completed milestone",
            internal_note: "Dev capacity is short by one FTE.",
            team_id: "team-1",
            linked_tasks: [],
            linked_files: [],
          },
        ]),
      ],
    ]);

    const [milestone] = await listClientMilestones(db, subject(), "project-1");

    expect(milestone).toEqual({
      id: "m1",
      name: "Development & CMS build",
      description: "Front-end build.",
      target_date: "2026-06-30",
      status: "delayed",
      completed_at: null,
      completion_note: "",
      date_moved: true,
      linked_tasks: [],
      linked_files: [],
    });
    expect(JSON.stringify(milestone)).not.toMatch(/capacity|internal_note|team_id/);
  });

  it("only shows a completion note once the milestone is completed", async () => {
    const db = fakeDb([
      PROJECT_ROW,
      [
        /FROM client_portal_milestones m/,
        createQueryResult([
          { id: "m2", name: "Audit", description: "", target_date: "2026-03-20", status: "completed", completed_at: "2026-03-18", completion_note: "Findings shared.", linked_tasks: [], linked_files: [] },
        ]),
      ],
    ]);
    const [milestone] = await listClientMilestones(db, subject(), "project-1");
    expect(milestone.completion_note).toBe("Findings shared.");
    expect(milestone.date_moved).toBe(false);
  });

  it("never returns time, cost, assignee or comment data for a task", async () => {
    const db = fakeDb([
      PROJECT_ROW,
      [
        /FROM tasks t/,
        createQueryResult([
          {
            id: "t1",
            key: "WL-231",
            title: "Landing page copy",
            description: "Final copy.",
            status: "in_progress",
            due_date: "2026-06-05",
            attachments: [{ id: "f1", name: "Brief.docx", version: 2 }],
            assignee_name: "Kasun Fernando",
            estimate_hours: 12,
            logged_hours: 7.5,
            internal_comments: 3,
            billable: true,
          },
        ]),
      ],
    ]);

    const [task] = await listClientTasks(db, subject(), "project-1");

    expect(Object.keys(task).sort()).toEqual(["attachments", "description", "due_date", "id", "key", "status", "title"]);
    expect(JSON.stringify(task)).not.toMatch(/Kasun|estimate|logged|internal_comments|billable/);
  });

  it("maps the internal task status to the simpler client status", async () => {
    const rows = [
      { id: "a", key: "WL-1", title: "A", description: null, status: "todo", due_date: null, attachments: [] },
      { id: "b", key: "WL-2", title: "B", description: null, status: "in_progress", due_date: null, attachments: [] },
      { id: "c", key: "WL-3", title: "C", description: null, status: "done", due_date: null, attachments: [] },
    ];
    const db = fakeDb([PROJECT_ROW, [/FROM tasks t/, createQueryResult(rows)]]);
    const tasks = await listClientTasks(db, subject(), "project-1");
    expect(tasks.map(task => task.status)).toEqual(["not_started", "in_progress", "done"]);
  });

  it("never returns the assignee, internal assessment or linked task of a change request", async () => {
    const db = fakeDb([
      PROJECT_ROW,
      [
        /FROM client_portal_change_requests r/,
        createQueryResult([
          {
            id: "cr1",
            cr_no: "CR-0048",
            project_id: "project-1",
            project_name: "Brandbase Website Relaunch",
            title: "Spanish version",
            description: "Full site in Spanish.",
            notes: "",
            priority: "high",
            status: "more_info",
            submitted_at: "2026-06-01T09:20:00Z",
            requester_name: "Alex Chen",
            requester_contact_id: "contact-1",
            estimate_hours: null,
            estimate_cost: null,
            response: "Which plan?",
            attachments: [],
            assignee_name: "Kasun Fernando",
            internal_assessment: "Roughly 60 to 80 hours. Check capacity.",
            linked_task_key: "WL-246",
          },
        ]),
      ],
    ]);

    const [request] = await listClientChangeRequests(db, subject());

    expect(JSON.stringify(request)).not.toMatch(/Kasun|capacity|internal_assessment|WL-246|assignee/);
    // A blank estimate stays blank, never 0.
    expect(request.estimate).toBeNull();
    expect(request.needs_your_reply).toBe(true);
  });

  it("only asks the requester to reply on a More Information Required request", async () => {
    const row = (requester: string, status: string) => ({
      id: "cr", cr_no: "CR-1", project_id: "project-1", project_name: "P", title: "T", description: "D", notes: "",
      priority: "low", status, submitted_at: "x", requester_name: "R", requester_contact_id: requester,
      estimate_hours: 0, estimate_cost: 0, response: "", attachments: [],
    });
    const db = fakeDb([
      PROJECT_ROW,
      [/FROM client_portal_change_requests r/, createQueryResult([row("someone-else", "more_info"), row("contact-1", "approved")])],
    ]);
    const [other, mine] = await listClientChangeRequests(db, subject());
    expect(other.needs_your_reply).toBe(false);
    expect(mine.needs_your_reply).toBe(false);
    // An estimate staff entered as 0 is shown as 0.
    expect(other.estimate).toEqual({ hours: 0, cost: 0 });
  });
});

describe("approvals as the client sees them", () => {
  const approvalRow = (overrides: Record<string, unknown> = {}) => ({
    id: "ap1", ref_no: "AP-000123", project_id: "project-1", project_name: "P", title: "Approve wireframe",
    status: "awaiting", revision: 1, linked_type: "file", item_name: "Wireframe.fig", item_task_key: null,
    linked_file_version: 3, freeform_description: null, instructions: "Check it", due_date: "2026-06-06",
    is_approver: true, is_overdue: false, item_available: true,
    outcome: null, decided_by_name: null, decided_at: null, decision_comment: null,
    ...overrides,
  });

  const listWith = async (role: ClientSubject["role"], row: Record<string, unknown>) => {
    const db = fakeDb([PROJECT_ROW, [/FROM client_portal_approvals a/, createQueryResult([approvalRow(row)])]]);
    return { db, items: await listClientApprovals(db, subject(role)) };
  };

  it("excludes Draft approvals in the query itself", async () => {
    const { db } = await listWith("admin", {});
    const sql = db.calls().find(text => /FROM client_portal_approvals a/.test(text))!;
    expect(sql).toMatch(/a\.status <> 'draft'/);
    expect(sql).toMatch(/a\.client_id = \$2/);
  });

  it("lets only a named approver decide, and only while Awaiting", async () => {
    expect((await listWith("admin", {})).items[0].can_decide).toBe(true);
    expect((await listWith("admin", { is_approver: false })).items[0].can_decide).toBe(false);
    expect((await listWith("admin", { status: "approved", outcome: "approved", decided_by_name: "Alex", decided_at: "x", decision_comment: "ok" })).items[0].can_decide).toBe(false);
  });

  it("lets only a named approver who is a Client Admin decide (spec #2522)", async () => {
    expect((await listWith("admin", {})).items[0].can_decide).toBe(true);
    // Being named is not enough for a Member or a Viewer: deciding is a Client Admin capability.
    for (const role of ["member", "viewer"] as const) {
      expect((await listWith(role, {})).items[0].can_decide).toBe(false);
    }
    expect((await listWith("admin", { is_approver: false })).items[0].can_decide).toBe(false);
  });

  it("marks a withdrawn linked item as no longer available instead of hiding the approval", async () => {
    const { items } = await listWith("admin", { item_available: false });
    expect(items[0].linked_item.available).toBe(false);
    expect(items[0].linked_item.name).toBe("Wireframe.fig");
  });

  it("keeps a free-form item's description and ignores it for other types", async () => {
    const freeform = (await listWith("admin", { linked_type: "freeform", freeform_description: "Soft launch first." })).items[0];
    expect(freeform.linked_item.description).toBe("Soft launch first.");
    const file = (await listWith("admin", { freeform_description: "stale text" })).items[0];
    expect(file.linked_item.description).toBeNull();
  });
});

describe("the dashboard", () => {
  it("counts only what this user can act on and excludes completed projects from active ones", async () => {
    const project = (id: string, status: string) => ({
      id, name: id, client_status: status, current_phase: null, progress: 10, start_date: null, expected_completion: null,
      client_summary: "", allow_client_uploads: true, contact_name: null, update_body: null, update_at: null,
      milestones_shared: 0, tasks_shared: 0, files_shared: 0,
    });
    const db = fakeDb([
      [/FROM projects p\s+JOIN client_contact_project_access/, createQueryResult([{ id: "p1" }, { id: "p2" }])],
      [/FROM projects p\s+JOIN project_client_settings/, createQueryResult([project("p1", "on_track"), project("p2", "completed")])],
      [
        /FROM client_portal_approvals a/,
        createQueryResult([
          { id: "a1", ref_no: "AP-1", project_id: "p1", project_name: "p1", title: "Mine", status: "awaiting", revision: 1, linked_type: "freeform", item_name: "x", item_task_key: null, linked_file_version: null, freeform_description: "", instructions: "", due_date: null, is_approver: true, is_overdue: false, item_available: true },
          { id: "a2", ref_no: "AP-2", project_id: "p1", project_name: "p1", title: "Not mine", status: "awaiting", revision: 1, linked_type: "freeform", item_name: "x", item_task_key: null, linked_file_version: null, freeform_description: "", instructions: "", due_date: null, is_approver: false, is_overdue: false, item_available: true },
        ]),
      ],
    ]);

    const dashboard = await getClientDashboard(db, subject());

    expect(dashboard.active_projects).toBe(1);
    expect(dashboard.pending_actions).toBe(1);
    expect(dashboard.needs_action.map(item => item.ref_no)).toEqual(["AP-1"]);
  });
});

describe("PortalError", () => {
  it("is a real Error so a stack is kept", () => {
    expect(new PortalError(404, "x")).toBeInstanceOf(Error);
  });
});
