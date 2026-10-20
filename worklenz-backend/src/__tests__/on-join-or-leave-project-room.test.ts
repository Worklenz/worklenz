import { on_join_project_room } from "../socket.io/commands/on-join-or-leave-project-room";
import { verifyProjectAccessSocket, logUnauthorizedSocketAccess } from "../socket.io/authorization";
import { Server, Socket } from "socket.io";

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock("../shared/utils", () => ({
  log_error: jest.fn(),
  getColor: jest.fn(() => "#000000"),
}));

jest.mock("../socket.io/authorization", () => ({
  verifyProjectAccessSocket: jest.fn(),
  logUnauthorizedSocketAccess: jest.fn(),
}));

jest.mock("../controllers/tasks-controller-v2", () => ({
  __esModule: true,
  default: {
    createTagList: jest.fn(() => []),
  },
}));

describe("on_join_project_room authorization", () => {
  let mockIo: Partial<Server>;
  let mockSocket: Partial<Socket>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSocket = {
      id: "socket-123",
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    } as unknown as Socket;

    mockIo = {
      in: jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([]),
      }),
    } as unknown as Server;
  });

  it("blocks join when user has no access to the project", async () => {
    (verifyProjectAccessSocket as jest.Mock).mockResolvedValue(false);

    await on_join_project_room(
      mockIo as Server,
      mockSocket as Socket,
      { id: "project-uuid-1", type: "join" }
    );

    expect(verifyProjectAccessSocket).toHaveBeenCalledWith(mockSocket, "project-uuid-1");
    expect(logUnauthorizedSocketAccess).toHaveBeenCalledWith(
      mockSocket,
      "JOIN_OR_LEAVE_PROJECT_ROOM",
      "project",
      "project-uuid-1"
    );
    expect(mockSocket.join).not.toHaveBeenCalled();
  });

  it("allows join when user has access to the project", async () => {
    (verifyProjectAccessSocket as jest.Mock).mockResolvedValue(true);

    await on_join_project_room(
      mockIo as Server,
      mockSocket as Socket,
      { id: "project-uuid-1", type: "join" }
    );

    expect(verifyProjectAccessSocket).toHaveBeenCalledWith(mockSocket, "project-uuid-1");
    expect(logUnauthorizedSocketAccess).not.toHaveBeenCalled();
    expect(mockSocket.join).toHaveBeenCalledWith("project-uuid-1");
  });

  it("leaves room when type is leave", async () => {
    (verifyProjectAccessSocket as jest.Mock).mockResolvedValue(true);

    await on_join_project_room(
      mockIo as Server,
      mockSocket as Socket,
      { id: "project-uuid-1", type: "leave" }
    );

    expect(mockSocket.leave).toHaveBeenCalledWith("project-uuid-1");
  });
});
