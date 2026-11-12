import { Server, Socket } from "socket.io";
import { on_join_client_portal_room } from "../socket.io/commands/client-portal/on-join-client-portal-room";
import {
  clientPortalClientRoomName,
  clientPortalContactRoomName,
  clientPortalTeamRoomName,
} from "../socket.io/client-portal-room";
import TokenService from "../services/token-service";
import db from "../config/db";
import { logUnauthorizedSocketAccess } from "../socket.io/authorization";

jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock("../services/token-service", () => ({
  __esModule: true,
  default: {
    verifyClientToken: jest.fn(),
    hasOrganizationAccess: jest.fn(),
  },
}));

jest.mock("../socket.io/authorization", () => ({
  logUnauthorizedSocketAccess: jest.fn(),
}));

jest.mock("../socket.io/util", () => ({
  log_error: jest.fn(),
}));

describe("on_join_client_portal_room", () => {
  let mockIo: Partial<Server>;
  let mockSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = {
      id: "socket-1",
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      request: { session: { passport: { user: { id: "user-1" } } } },
      handshake: { auth: {} },
    };
    mockIo = {};
  });

  it("joins the team room for an owner/admin staff member", async () => {
    (db.query as jest.Mock).mockResolvedValue({
      rows: [{ team_id: "team-1", owner_id: "user-1", role_name: "Owner", admin_role: false }],
    });

    await on_join_client_portal_room(mockIo as Server, mockSocket as Socket, { type: "join" });

    expect(mockSocket.join).toHaveBeenCalledWith(clientPortalTeamRoomName("team-1"));
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("u.active_team"), ["user-1"]);
    expect(logUnauthorizedSocketAccess).not.toHaveBeenCalled();
  });

  it("rejects staff who are not owner/admin", async () => {
    (db.query as jest.Mock).mockResolvedValue({
      rows: [{ team_id: "team-1", owner_id: "other-owner", role_name: "Member", admin_role: false }],
    });

    await on_join_client_portal_room(mockIo as Server, mockSocket as Socket, { type: "join" });

    expect(mockSocket.join).not.toHaveBeenCalled();
    expect(logUnauthorizedSocketAccess).toHaveBeenCalled();
  });

  it("leaves the old team room when the active team changes", async () => {
    mockSocket.rooms = new Set(["socket-1", clientPortalTeamRoomName("old-team")]);
    (db.query as jest.Mock).mockResolvedValue({
      rows: [{ team_id: "team-2", owner_id: "user-1", role_name: "Owner", admin_role: false }],
    });

    await on_join_client_portal_room(mockIo as Server, mockSocket as Socket, { type: "join" });

    expect(mockSocket.leave).toHaveBeenCalledWith(clientPortalTeamRoomName("old-team"));
    expect(mockSocket.join).toHaveBeenCalledWith(clientPortalTeamRoomName("team-2"));
  });

  it("leaves staff portal rooms without looking up the active team", async () => {
    mockSocket.rooms = new Set(["socket-1", clientPortalTeamRoomName("team-1")]);
    await on_join_client_portal_room(mockIo as Server, mockSocket as Socket, { type: "leave" });
    expect(mockSocket.leave).toHaveBeenCalledWith(clientPortalTeamRoomName("team-1"));
    expect(db.query).not.toHaveBeenCalled();
  });

  const activeSubjectRow = {
    contact_id: "contact-1",
    client_id: "client-1",
    team_id: "team-1",
    role: "member",
    name: "Ada",
    email: "a@b.com",
    client_user_id: "cu-1",
  };

  it("joins the client and contact rooms when organization access and the subject are active", async () => {
    mockSocket.request = { session: {} };
    (TokenService.verifyClientToken as jest.Mock).mockReturnValue({
      clientId: "client-1",
      organizationId: "team-1",
      clientUserId: "cu-1",
      email: "a@b.com",
      type: "client",
    });
    (TokenService.hasOrganizationAccess as jest.Mock).mockResolvedValue(true);
    (db.query as jest.Mock).mockResolvedValue({ rows: [activeSubjectRow] });

    await on_join_client_portal_room(mockIo as Server, mockSocket as Socket, {
      type: "join",
      token: "client-jwt",
    });

    const sql = (db.query as jest.Mock).mock.calls[0][0] as string;
    expect(sql).toContain("activated_at IS NOT NULL");
    expect(sql).toContain("cu.deleted_at IS NULL");
    expect(sql).toContain("c.deleted_at IS NULL");
    expect(sql).toContain("c.status <> 'inactive'");
    expect(sql).toContain("COALESCE((SELECT cpa.is_active FROM client_portal_access cpa WHERE cpa.client_id = c.id LIMIT 1), TRUE)");
    expect(sql).not.toContain("IS NULL OR cu.id");
    expect(TokenService.hasOrganizationAccess).toHaveBeenCalledWith("cu-1", "team-1");
    expect(mockSocket.join).toHaveBeenCalledWith(clientPortalClientRoomName("team-1", "client-1"));
    expect(mockSocket.join).toHaveBeenCalledWith(
      clientPortalContactRoomName("team-1", "client-1", "contact-1")
    );
    expect(logUnauthorizedSocketAccess).not.toHaveBeenCalled();
  });

  it("rejects a token that does not identify a contact", async () => {
    mockSocket.request = { session: {} };
    (TokenService.verifyClientToken as jest.Mock).mockReturnValue({
      clientId: "client-1",
      organizationId: "team-1",
      email: "a@b.com",
      type: "client",
    });

    await on_join_client_portal_room(mockIo as Server, mockSocket as Socket, {
      type: "join",
      token: "client-jwt",
    });

    expect(TokenService.hasOrganizationAccess).not.toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
    expect(mockSocket.join).not.toHaveBeenCalled();
    expect(logUnauthorizedSocketAccess).toHaveBeenCalled();
  });

  it("rejects a client whose organization access was revoked", async () => {
    mockSocket.request = { session: {} };
    (TokenService.verifyClientToken as jest.Mock).mockReturnValue({
      clientId: "client-1",
      organizationId: "team-1",
      clientUserId: "cu-1",
      email: "a@b.com",
      type: "client",
    });
    (TokenService.hasOrganizationAccess as jest.Mock).mockResolvedValue(false);

    await on_join_client_portal_room(mockIo as Server, mockSocket as Socket, {
      type: "join",
      token: "client-jwt",
    });

    expect(db.query).not.toHaveBeenCalled();
    expect(mockSocket.join).not.toHaveBeenCalled();
    expect(mockSocket.leave).toHaveBeenCalledWith(clientPortalClientRoomName("team-1", "client-1"));
    expect(logUnauthorizedSocketAccess).toHaveBeenCalled();
  });

  it("rejects a client when portal access is disabled", async () => {
    mockSocket.request = { session: {} };
    (TokenService.verifyClientToken as jest.Mock).mockReturnValue({
      clientId: "client-1", organizationId: "team-1", clientUserId: "cu-1", type: "client",
    });
    (TokenService.hasOrganizationAccess as jest.Mock).mockResolvedValue(true);
    (db.query as jest.Mock).mockImplementation(async (sql: string) => {
      expect(sql).toContain("FROM client_portal_access cpa");
      return { rows: [] };
    });

    await on_join_client_portal_room(mockIo as Server, mockSocket as Socket, {
      type: "join", token: "client-jwt",
    });

    expect(mockSocket.join).not.toHaveBeenCalled();
    expect(mockSocket.leave).toHaveBeenCalledWith(clientPortalClientRoomName("team-1", "client-1"));
  });

  it("rejects a client when the organization or contact is inactive", async () => {
    mockSocket.request = { session: {} };
    (TokenService.verifyClientToken as jest.Mock).mockReturnValue({
      clientId: "client-1",
      organizationId: "team-1",
      clientUserId: "cu-1",
      email: "a@b.com",
      type: "client",
    });
    (TokenService.hasOrganizationAccess as jest.Mock).mockResolvedValue(true);
    (db.query as jest.Mock).mockResolvedValue({ rows: [] });

    await on_join_client_portal_room(mockIo as Server, mockSocket as Socket, {
      type: "join",
      token: "client-jwt",
    });

    expect(db.query).toHaveBeenCalledWith(expect.any(String), ["cu-1", "client-1", "team-1"]);
    expect(mockSocket.join).not.toHaveBeenCalled();
    expect(mockSocket.leave).toHaveBeenCalledWith(clientPortalClientRoomName("team-1", "client-1"));
    expect(logUnauthorizedSocketAccess).toHaveBeenCalled();
  });

  it("leaves the client room on leave", async () => {
    mockSocket.request = { session: {} };
    (TokenService.verifyClientToken as jest.Mock).mockReturnValue({
      clientId: "client-1",
      organizationId: "team-1",
      email: "a@b.com",
      type: "client",
    });

    await on_join_client_portal_room(mockIo as Server, mockSocket as Socket, {
      type: "leave",
      token: "client-jwt",
    });

    expect(mockSocket.leave).toHaveBeenCalledWith(clientPortalClientRoomName("team-1", "client-1"));
    expect(db.query).not.toHaveBeenCalled();
  });

  it("leaves the contact room recorded on the socket", async () => {
    mockSocket.request = { session: {} };
    mockSocket.user = { contactId: "contact-1" };
    mockSocket.rooms = new Set([
      "socket-1",
      clientPortalContactRoomName("team-1", "client-1", "contact-1"),
    ]);
    (TokenService.verifyClientToken as jest.Mock).mockReturnValue({
      clientId: "client-1",
      organizationId: "team-1",
      clientUserId: "cu-1",
      email: "a@b.com",
      type: "client",
    });

    await on_join_client_portal_room(mockIo as Server, mockSocket as Socket, {
      type: "leave",
      token: "client-jwt",
    });

    expect(mockSocket.leave).toHaveBeenCalledWith(clientPortalClientRoomName("team-1", "client-1"));
    expect(mockSocket.leave).toHaveBeenCalledWith(
      clientPortalContactRoomName("team-1", "client-1", "contact-1")
    );
    expect(mockSocket.join).not.toHaveBeenCalled();
  });
});
