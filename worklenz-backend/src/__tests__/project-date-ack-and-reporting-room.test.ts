import { Server, Socket } from "socket.io";
import db from "../config/db";
import { on_project_start_date_change } from "../socket.io/commands/on-project-start-date-change";
import { on_project_end_date_change } from "../socket.io/commands/on-project-end-date-change";
import { on_join_or_leave_reporting_room } from "../socket.io/commands/on-join-or-leave-reporting-room";
import { verifyProjectAccessSocket } from "../socket.io/authorization";

jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../shared/utils", () => ({ log_error: jest.fn(), getColor: jest.fn() }));
jest.mock("../socket.io/authorization", () => ({
  verifyProjectAccessSocket: jest.fn(),
  logUnauthorizedSocketAccess: jest.fn(),
}));

const makeSocket = (user?: Record<string, unknown>) => {
  const chain: any = { emit: jest.fn() };
  chain.to = jest.fn().mockReturnValue(chain);
  return {
    id: "s1",
    emit: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined),
    broadcast: { to: jest.fn().mockReturnValue(chain) },
    request: { session: { passport: { user } } },
    chain,
  } as unknown as Socket & { chain: any };
};

describe.each([
  ["start", on_project_start_date_change, "start_date"],
  ["end", on_project_end_date_change, "end_date"],
])("project %s date change ack", (_name, handler, col) => {
  beforeEach(() => jest.clearAllMocks());
  const body = (extra = {}) => JSON.stringify({ project_id: "p1", [col]: "2026-01-01", ...extra });

  it("acks failure and does not write when access is denied", async () => {
    (verifyProjectAccessSocket as jest.Mock).mockResolvedValue(false);
    const cb = jest.fn();
    await handler({} as Server, makeSocket({ id: "u1" }), body(), cb);
    expect(db.query).not.toHaveBeenCalled();
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it("acks failure when the database write fails", async () => {
    (verifyProjectAccessSocket as jest.Mock).mockResolvedValue(true);
    (db.query as jest.Mock).mockRejectedValue(new Error("db down"));
    const cb = jest.fn();
    await handler({} as Server, makeSocket({ id: "u1" }), body(), cb);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it("acks success and broadcasts to project and reporting rooms", async () => {
    (verifyProjectAccessSocket as jest.Mock).mockResolvedValue(true);
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ [col]: "2026-01-01", org_owner_id: "owner1" }] });
    const socket = makeSocket({ id: "u1" });
    const cb = jest.fn();
    await handler({} as Server, socket, body(), cb);
    expect(socket.broadcast.to).toHaveBeenCalledWith("p1");
    expect((socket as any).chain.to).toHaveBeenCalledWith("reporting:owner1");
    expect(cb).toHaveBeenCalledWith({ success: true });
  });
});

describe("on_join_or_leave_reporting_room", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ user_id: "owner1" }] });
  });

  it("joins the org room for an admin", async () => {
    const socket = makeSocket({ id: "u1", team_id: "t1", role_name: "Admin" });
    await on_join_or_leave_reporting_room({} as Server, socket, { type: "join" });
    expect(socket.join).toHaveBeenCalledWith("reporting:owner1");
  });

  it("refuses a regular member", async () => {
    const socket = makeSocket({ id: "u2", team_id: "t1", role_name: "Member" });
    await on_join_or_leave_reporting_room({} as Server, socket, { type: "join" });
    expect(socket.join).not.toHaveBeenCalled();
  });

  it("leaves the room on leave", async () => {
    const socket = makeSocket({ id: "u2", team_id: "t1", role_name: "Member" });
    await on_join_or_leave_reporting_room({} as Server, socket, { type: "leave" });
    expect(socket.leave).toHaveBeenCalledWith("reporting:owner1");
  });
});
