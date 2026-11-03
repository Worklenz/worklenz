import { Server, Socket } from "socket.io";
import { on_join_client_portal_room } from "../socket.io/commands/client-portal/on-join-client-portal-room";
import { clientPortalClientRoomName, clientPortalTeamRoomName } from "../socket.io/client-portal-room";
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
      request: { session: { passport: { user: { id: "user-1", team_id: "team-1" } } } },
      handshake: { auth: {} },
    };
    mockIo = {};
  });

  it("joins the team room for an owner/admin staff member", async () => {
    (db.query as jest.Mock).mockResolvedValue({
      rows: [{ owner_id: "user-1", role_name: "Owner", admin_role: false }],
    });

    await on_join_client_portal_room(mockIo as Server, mockSocket as Socket, { type: "join" });

    expect(mockSocket.join).toHaveBeenCalledWith(clientPortalTeamRoomName("team-1"));
    expect(logUnauthorizedSocketAccess).not.toHaveBeenCalled();
  });

  it("rejects staff who are not owner/admin", async () => {
    (db.query as jest.Mock).mockResolvedValue({
      rows: [{ owner_id: "other-owner", role_name: "Member", admin_role: false }],
    });

    await on_join_client_portal_room(mockIo as Server, mockSocket as Socket, { type: "join" });

    expect(mockSocket.join).not.toHaveBeenCalled();
    expect(logUnauthorizedSocketAccess).toHaveBeenCalled();
  });

  it("joins the client room for a valid client token", async () => {
    mockSocket.request = { session: {} };
    (TokenService.verifyClientToken as jest.Mock).mockReturnValue({
      clientId: "client-1",
      organizationId: "team-1",
      clientUserId: "cu-1",
      email: "a@b.com",
      type: "client",
    });
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ "?column?": 1 }] });

    await on_join_client_portal_room(mockIo as Server, mockSocket as Socket, {
      type: "join",
      token: "client-jwt",
    });

    expect(mockSocket.join).toHaveBeenCalledWith(clientPortalClientRoomName("team-1", "client-1"));
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
  });
});
