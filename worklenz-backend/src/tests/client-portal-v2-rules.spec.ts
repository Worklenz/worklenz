jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), pool: { connect: jest.fn() } },
}));
jest.mock("../shared/email", () => ({
  __esModule: true,
  sendEmail: jest.fn(),
  sendEmailEnhanced: jest.fn(),
  EmailRequest: jest.fn(),
}));
jest.mock("../cron_jobs/helpers", () => ({
  __esModule: true,
  getClientPortalBaseUrl: () => "https://portal.test",
}));

import { requireClientCapability } from "../middlewares/client-subject-middleware";
import { handlePortalError } from "../controllers/client-portal/v2/portal-http";
import { csvCell } from "../services/client-portal-v2/audit-log.service";
import { decisionReference } from "../services/client-portal-v2/approvals.service";
import { ContactServiceError } from "../services/client-contacts-service";
import { PortalError, conflict, forbidden } from "../services/client-portal-v2/errors";
import { formatApprovalRef, formatChangeRequestNo } from "../services/client-portal-v2/sequences";
import { DEFAULT_PORTAL_SETTINGS_V2, applySettingsPatch } from "../services/client-portal-v2/settings.service";
import { toStaffRef } from "../services/client-portal-v2/staff";
import { mapUserRow, USER_VIEW_SQL } from "../services/client-portal-v2/users.service";
import { CLIENT_ROLE_DEFINITIONS, clientRoleCan, isClientContactRole } from "../shared/client-portal-permissions";
import { sanitizeDisplayName } from "../shared/project-file-rules";
import { createMockResponse } from "./utils/express-mock";

describe("client user project list SQL", () => {
  it("lists portal-enabled org projects for Client Admins, not only access rows", () => {
    // Production assigns projects at the organization level; admins inherit them without
    // client_contact_project_access rows. The Clients and Client Users counts must match.
    expect(USER_VIEW_SQL).toContain("WHEN cc.role = 'admin'");
    expect(USER_VIEW_SQL).toContain("pcs.portal_enabled IS TRUE");
    expect(USER_VIEW_SQL).toContain("client_contact_project_access");
  });
});

describe("client roles", () => {
  it("has exactly the three v2 roles, and the retired poc role is not one of them", () => {
    expect(CLIENT_ROLE_DEFINITIONS.map(role => role.role)).toEqual(["admin", "member", "viewer"]);
    expect(isClientContactRole("poc")).toBe(false);
    expect(isClientContactRole("viewer")).toBe(true);
  });

  it("lets only a Client Admin approve and manage users", () => {
    expect(clientRoleCan("admin", "approve")).toBe(true);
    expect(clientRoleCan("member", "approve")).toBe(false);
    expect(clientRoleCan("viewer", "approve")).toBe(false);
    expect(clientRoleCan("admin", "manage_users")).toBe(true);
    expect(clientRoleCan("member", "manage_users")).toBe(false);
  });

  it("lets Admins and Members comment, upload and submit change requests, but not Viewers", () => {
    for (const capability of ["comment", "upload", "submit_change_request"] as const) {
      expect(clientRoleCan("admin", capability)).toBe(true);
      expect(clientRoleCan("member", capability)).toBe(true);
      expect(clientRoleCan("viewer", capability)).toBe(false);
    }
    expect(clientRoleCan("viewer", "view")).toBe(true);
  });

  it("gives an unknown role nothing", () => {
    expect(clientRoleCan("owner", "view")).toBe(false);
    expect(clientRoleCan(undefined, "view")).toBe(false);
  });
});

describe("requireClientCapability", () => {
  const run = (role: string | undefined, capability: Parameters<typeof requireClientCapability>[0]) => {
    const res = createMockResponse();
    const next = jest.fn();
    const req: any = role ? { clientSubject: { role } } : {};
    requireClientCapability(capability)(req, res, next);
    return { res, next };
  };

  it("lets a role that holds the capability through", () => {
    const { next, res } = run("admin", "approve");
    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it("stops a Client Viewer from approving with a 403", () => {
    const { next, res } = run("viewer", "approve");
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("stops a request that never resolved a subject", () => {
    const { next, res } = run(undefined, "view");
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});

describe("applySettingsPatch", () => {
  const defaults = DEFAULT_PORTAL_SETTINGS_V2;

  it("starts from the spec defaults", () => {
    expect(defaults.show_invoices).toBe(false);
    expect(defaults.allow_client_uploads_default).toBe(true);
    expect(defaults.admins_can_invite_users).toBe(false);
    expect(defaults).not.toHaveProperty("authentication");
    expect(Object.values(defaults.client_email_events).every(v => v === false)).toBe(true);
    expect(Object.values(defaults.team_email_events).every(v => v === false)).toBe(true);
  });

  it("merges a partial patch and leaves everything else alone", () => {
    const next = applySettingsPatch(defaults, {
      show_invoices: true,
      client_email_events: { file_shared: true },
    });
    expect(next.show_invoices).toBe(true);
    expect(next.client_email_events.file_shared).toBe(true);
    expect(next.client_email_events.approval_request).toBe(false);
    expect(next.admins_can_remove_users).toBe(false);
  });

  it("has no sign-in configuration: a patch that tries to set one is ignored", () => {
    const next = applySettingsPatch(defaults, { authentication: { password: true } } as any);
    expect(next).not.toHaveProperty("authentication");
  });

  it("ignores unknown event keys and non-boolean values instead of storing them", () => {
    const next = applySettingsPatch(defaults, {
      client_email_events: { not_an_event: true, comment_or_reply: "yes" } as any,
      show_invoices: "true" as any,
    });
    expect(next.client_email_events).toEqual(defaults.client_email_events);
    expect(Object.keys(next.client_email_events)).not.toContain("not_an_event");
    expect(next.show_invoices).toBe(false);
  });

  it("does not mutate the settings it was given", () => {
    const before = JSON.stringify(defaults);
    applySettingsPatch(defaults, { show_invoices: true });
    expect(JSON.stringify(defaults)).toBe(before);
  });
});

describe("audit CSV cells", () => {
  it("quotes a value and doubles embedded quotes", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe('""');
  });

  it.each(["=SUM(A1:A9)", "+1+1", "-2+3", "@cmd", "\tcmd", "\rcmd"])(
    "neutralises a spreadsheet formula starting with %j",
    value => {
      // A client controls their own name, so a leading = + - @ must never run as a formula.
      expect(csvCell(value).startsWith(`"'`)).toBe(true);
    }
  );

  it("leaves ordinary text alone", () => {
    expect(csvCell("Alex Chen")).toBe('"Alex Chen"');
    expect(csvCell("AP-000123 · Approve homepage wireframe v3")).toBe('"AP-000123 · Approve homepage wireframe v3"');
  });
});

describe("file display names", () => {
  it("keeps a readable name", () => {
    expect(sanitizeDisplayName("My Report (Final).pdf", "pdf")).toBe("My Report (Final).pdf");
  });

  it("strips path separators and header-breaking characters from the name", () => {
    const name = sanitizeDisplayName('../etc/pass"wd;evil,x.pdf', "pdf");
    expect(name).not.toMatch(/[/\\"";,]/);
    expect(name.endsWith(".pdf")).toBe(true);
  });

  it("strips control characters, including CR and LF (response splitting)", () => {
    const name = sanitizeDisplayName("a\r\nSet-Cookie: x=1.pdf", "pdf");
    expect(name).not.toMatch(/[\r\n\x00-\x1f]/);
  });

  it("falls back to a placeholder when nothing safe is left", () => {
    expect(sanitizeDisplayName('<>:"|?*.pdf', "pdf")).toBe("file.pdf");
  });
});

describe("reference numbers and decision references", () => {
  it("formats an approval as AP-000123 and a change request as CR-0048", () => {
    expect(formatApprovalRef(123)).toBe("AP-000123");
    expect(formatApprovalRef(1)).toBe("AP-000001");
    expect(formatChangeRequestNo(48)).toBe("CR-0048");
    expect(formatChangeRequestNo(12345)).toBe("CR-12345");
  });

  it("records a file decision against the exact version", () => {
    expect(decisionReference({ type: "file", name: "Homepage Wireframe.fig", file_version: 3, revision: 1 })).toBe(
      "Homepage Wireframe.fig v3"
    );
  });

  it("records a task, milestone or free-form decision against the item name and revision", () => {
    expect(decisionReference({ type: "task", name: "Content migration plan", file_version: null, revision: 1 })).toBe(
      "Content migration plan, revision 1"
    );
    expect(decisionReference({ type: "freeform", name: "Launch rollout approach", file_version: null, revision: 2 })).toBe(
      "Launch rollout approach, revision 2"
    );
  });
});

describe("client user status flags", () => {
  const base = {
    id: "u1",
    client_id: "c1",
    name: "Priyanka Mendis",
    email: "p@avant.lk",
    phone: null,
    job_title: null,
    role: "member",
    email_verified_at: null,
    new_link_requested_at: null,
    invited_at: "2026-05-31T10:00:00Z",
    last_access_at: null,
    organization_name: "Avant",
    projects: [],
    status_key: "invited",
    invitation_lapsed: false,
    no_invitation: false,
  };

  it("shows an active user as active with no invitation flags", () => {
    const user = mapUserRow({ ...base, status_key: "active", email_verified_at: "2026-03-03T09:38:00Z" });
    expect(user).toMatchObject({
      status: "active",
      invite_expired: false,
      invite_not_sent: false,
      new_link_requested: false,
      email_verified: true,
    });
  });

  it("treats Invite expired as a flag on an Invited user, not a separate status", () => {
    const user = mapUserRow({ ...base, invitation_lapsed: true });
    expect(user.status).toBe("invited");
    expect(user.invite_expired).toBe(true);
    expect(user.email_verified).toBe(false);
  });

  it("flags an invitation that was never sent, and a client's request for a new link", () => {
    const user = mapUserRow({ ...base, no_invitation: true, new_link_requested_at: "2026-06-01T00:00:00Z" });
    expect(user.invite_not_sent).toBe(true);
    expect(user.new_link_requested).toBe(true);
  });

  it("never shows invitation flags on a deactivated user", () => {
    const user = mapUserRow({
      ...base,
      status_key: "deactivated",
      invitation_lapsed: true,
      no_invitation: true,
      new_link_requested_at: "x",
    });
    expect(user).toMatchObject({ status: "deactivated", invite_expired: false, invite_not_sent: false, new_link_requested: false });
  });
});

describe("staff references", () => {
  it("shortens a full name and builds initials", () => {
    expect(toStaffRef("tm-1", "Kasun Fernando")).toMatchObject({ short_name: "Kasun F.", initials: "KF" });
    expect(toStaffRef("tm-2", "Priya").short_name).toBe("Priya");
  });
});

describe("handlePortalError", () => {
  const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  afterAll(() => spy.mockRestore());

  it("answers a PortalError with its own status, message and code", () => {
    const res = createMockResponse();
    handlePortalError(res, conflict("Already there", "LAST_CLIENT_ADMIN"), "fallback");
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ done: false, message: "Already there", body: { code: "LAST_CLIENT_ADMIN" } });
  });

  it("answers a role failure with 403", () => {
    const res = createMockResponse();
    handlePortalError(res, forbidden("Nope"), "fallback");
    expect(res.statusCode).toBe(403);
  });

  it("maps a contact-service failure through its own status table", () => {
    const res = createMockResponse();
    handlePortalError(res, new ContactServiceError("EMAIL_TAKEN", "taken"), "fallback");
    expect(res.statusCode).toBe(409);
  });

  it("turns a unique-violation race into a 409 rather than a 500", () => {
    const res = createMockResponse();
    handlePortalError(res, { code: "23505", constraint: "x" }, "fallback");
    expect(res.statusCode).toBe(409);
  });

  it("hides internals behind the fallback message on an unexpected error", () => {
    const res = createMockResponse();
    handlePortalError(res, new Error("connection to 10.0.0.5 refused, password=hunter2"), "Failed to load");
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
    expect(res.body).toMatchObject({ done: false, message: "Failed to load" });
  });
});
