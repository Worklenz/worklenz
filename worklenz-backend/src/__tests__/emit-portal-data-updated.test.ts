import { IO } from "../shared/io";
import db from "../config/db";
import { emitPortalDataUpdated, notifyClientUsers } from "../services/client-portal-v2/notify.service";
import { CLIENT_PORTAL_SOCKET, clientPortalClientRoomName, clientPortalContactRoomName, clientPortalTeamRoomName } from "../socket.io/client-portal-room";

jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock("../shared/io", () => ({
  IO: {
    emitToRoom: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock("../shared/email", () => ({
  sendEmail: jest.fn(),
}));

jest.mock("../services/notifications/notifications.service", () => ({
  NotificationsService: { createNotification: jest.fn() },
}));

const TEAM = "team-1";
const CLIENT = "client-1";
const PROJECT = "project-1";
const APPROVAL = "approval-1";
const REQUEST = "request-1";
const APPROVER = "approver-1";
const EXCLUDED = "member-9";

const clientRoom = clientPortalClientRoomName(TEAM, CLIENT);

const roomEmits = () => (IO.emitToRoom as jest.Mock).mock.calls as Array<[string, string, { projectId?: string | null; referenceId?: string | null }]>;

const payloadFor = (room: string) => roomEmits().filter(call => call[0] === room).map(call => call[2]);

describe("emitPortalDataUpdated", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps project and reference ids off the shared client room", async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ id: APPROVER }] });

    await emitPortalDataUpdated(
      {
        teamId: TEAM,
        clientId: CLIENT,
        projectId: PROJECT,
        type: "approval",
        referenceId: APPROVAL,
        source: "staff",
      },
      { onlyContactIds: [APPROVER], staffSocketIds: ["staff-socket"] }
    );

    expect(payloadFor(clientPortalTeamRoomName(TEAM))[0]).toEqual(
      expect.objectContaining({ projectId: PROJECT, referenceId: APPROVAL })
    );
    expect(payloadFor(clientRoom)).toEqual([]);
    expect(payloadFor(clientPortalContactRoomName(TEAM, CLIENT, APPROVER))[1]).toEqual(
      expect.objectContaining({ projectId: PROJECT, referenceId: APPROVAL })
    );
    expect(payloadFor(clientPortalContactRoomName(TEAM, CLIENT, EXCLUDED))).toEqual([]);
    expect(IO.emit).toHaveBeenCalledWith(
      CLIENT_PORTAL_SOCKET.DATA_UPDATED,
      "staff-socket",
      expect.objectContaining({ referenceId: APPROVAL })
    );

    const audienceCall = (db.query as jest.Mock).mock.calls.find(call => call[1]?.[2] === PROJECT);
    expect(audienceCall?.[1]).toEqual([CLIENT, TEAM, PROJECT, [APPROVER], null]);
  });

  it("does not deliver identifiers when the authorized audience is empty", async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [] });

    await emitPortalDataUpdated(
      {
        teamId: TEAM,
        clientId: CLIENT,
        projectId: PROJECT,
        type: "approval",
        referenceId: APPROVAL,
        source: "staff",
      },
      { onlyContactIds: [] }
    );

    expect(payloadFor(clientRoom)).toEqual([]);
    expect(roomEmits().some(call => String(call[0]).startsWith("client_portal_contact:"))).toBe(false);
    const audienceCall = (db.query as jest.Mock).mock.calls.find(call => call[1]?.[2] === PROJECT);
    expect(audienceCall?.[1]?.[3]).toEqual([]);
  });

  it("does not emit to a connected contact after organization access is removed", async () => {
    (db.query as jest.Mock).mockImplementation(async (sql: string) => {
      expect(sql).toContain("FROM client_user_organizations cuo");
      return { rows: [] };
    });

    await emitPortalDataUpdated({
      teamId: TEAM, clientId: CLIENT, projectId: PROJECT,
      type: "approval", referenceId: APPROVAL, source: "staff",
    });

    expect(payloadFor(clientRoom)).toEqual([]);
    expect(payloadFor(clientPortalContactRoomName(TEAM, CLIENT, APPROVER))).toEqual([]);
  });

  it("does not emit to connected contacts after portal access is disabled", async () => {
    (db.query as jest.Mock).mockImplementation(async (sql: string) => {
      expect(sql).toContain("COALESCE((SELECT cpa.is_active FROM client_portal_access cpa WHERE cpa.client_id = c.id LIMIT 1), TRUE)");
      return { rows: [] };
    });

    await emitPortalDataUpdated({
      teamId: TEAM, clientId: CLIENT, projectId: PROJECT,
      type: "approval", referenceId: APPROVAL, source: "staff",
    });

    expect(payloadFor(clientRoom)).toEqual([]);
    expect(payloadFor(clientPortalContactRoomName(TEAM, CLIENT, APPROVER))).toEqual([]);
  });

  it("limits a change request with no named audience to the requester and client admins", async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ id: "requester-1" }, { id: "admin-1" }] });

    await emitPortalDataUpdated({
      teamId: TEAM,
      clientId: CLIENT,
      projectId: PROJECT,
      type: "change_request",
      referenceId: REQUEST,
      source: "staff",
    });

    const audienceCall = (db.query as jest.Mock).mock.calls.find(call => call[1]?.[2] === PROJECT);
    expect(String(audienceCall?.[0])).toContain("cc.role = 'admin'");
    expect(audienceCall?.[1]).toEqual([CLIENT, TEAM, PROJECT, null, REQUEST]);
    expect(payloadFor(clientRoom)).toEqual([]);
    expect(payloadFor(clientPortalContactRoomName(TEAM, CLIENT, "requester-1"))[1]).toEqual(
      expect.objectContaining({ referenceId: REQUEST })
    );
    expect(payloadFor(clientPortalContactRoomName(TEAM, CLIENT, "admin-1"))[1]).toEqual(
      expect.objectContaining({ referenceId: REQUEST })
    );
    expect(payloadFor(clientPortalContactRoomName(TEAM, CLIENT, EXCLUDED))).toEqual([]);
  });

  it("sends a project-scoped event only to contacts the audience query returns", async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ id: "member-1" }] });

    await emitPortalDataUpdated({
      teamId: TEAM,
      clientId: CLIENT,
      projectId: PROJECT,
      type: "file",
      referenceId: "file-1",
      source: "staff",
    });

    const audienceCall = (db.query as jest.Mock).mock.calls.find(call => call[1]?.[2] === PROJECT);
    expect(audienceCall?.[1]).toEqual([CLIENT, TEAM, PROJECT, null, null]);
    expect(String(audienceCall?.[0])).toContain("FROM client_user_organizations cuo");
    expect(String(audienceCall?.[0])).toContain("cuo.client_user_id = cu.id AND cuo.team_id = cc.team_id");
    expect(String(audienceCall?.[0])).toContain("cu.deleted_at IS NULL");
    expect(String(audienceCall?.[0])).toContain("c.status <> 'inactive'");
    expect(payloadFor(clientPortalContactRoomName(TEAM, CLIENT, "member-1"))).toHaveLength(2);
    expect(payloadFor(clientPortalContactRoomName(TEAM, CLIENT, EXCLUDED))).toEqual([]);
    expect(payloadFor(clientRoom)).toEqual([]);
  });
});

describe("notifyClientUsers realtime audience", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.query as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes("team_members")) {
        return {
          rows: [{ user_id: "staff-1", name: "Sam", email: "s@b.com", socket_id: "staff-socket", team_name: "Team" }],
        };
      }
      if (sql.includes("FROM client_contacts")) {
        return { rows: [{ id: APPROVER }] };
      }
      return { rows: [] };
    });
  });

  it("forwards onlyContactIds so a private approval is not broadcast to the client room", async () => {
    await notifyClientUsers({
      teamId: TEAM,
      clientId: CLIENT,
      projectId: PROJECT,
      type: "approval",
      title: "Approval requested",
      message: "Please review",
      referenceId: APPROVAL,
      onlyContactIds: [APPROVER],
    });

    const audienceCall = (db.query as jest.Mock).mock.calls.find(call => call[1]?.[2] === PROJECT);
    expect(audienceCall?.[1]).toEqual([CLIENT, TEAM, PROJECT, [APPROVER], null]);
    expect(payloadFor(clientRoom)).toEqual([]);
    expect(payloadFor(clientPortalContactRoomName(TEAM, CLIENT, APPROVER))[1]).toEqual(
      expect.objectContaining({ referenceId: APPROVAL })
    );
    expect(payloadFor(clientPortalContactRoomName(TEAM, CLIENT, EXCLUDED))).toEqual([]);
  });
});
