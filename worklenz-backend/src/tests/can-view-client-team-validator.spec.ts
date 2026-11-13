jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock("../shared/project-access", () => {
  const actual = jest.requireActual("../shared/project-access") as typeof import("../shared/project-access");
  return {
    ...actual,
    getProjectAccessForRequest: jest.fn(),
  };
});

import { NextFunction } from "express";

import db from "../config/db";
import canViewClientTeamValidator from "../middlewares/validators/can-view-client-team-validator";
import { IPassportSession } from "../interfaces/passport-session";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import {
  buildProjectAccess,
  getProjectAccessForRequest,
  IProjectMembershipContext,
} from "../shared/project-access";
import { TEAM_ROLE_NAMES } from "../shared/team-permissions";

const mockedDb = db as jest.Mocked<typeof db>;
const mockedGetProjectAccess = getProjectAccessForRequest as jest.MockedFunction<
  typeof getProjectAccessForRequest
>;

const PROJECT_ID = "085e8300-6949-49a4-9016-0688927446d0";
const TEAM_ID = "11111111-1111-1111-1111-111111111111";

const memberUser = {
  id: "user-1",
  team_id: TEAM_ID,
  owner: false,
  is_admin: false,
  is_guest: false,
} as unknown as IPassportSession;

const makeReq = (overrides: Partial<IWorkLenzRequest> = {}): IWorkLenzRequest =>
  ({
    user: memberUser,
    params: { projectId: PROJECT_ID },
    ...overrides,
  }) as unknown as IWorkLenzRequest;

const makeRes = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res as unknown as IWorkLenzResponse & {
    status: jest.Mock;
    send: jest.Mock;
  };
};

const memberAccess = (overrides: Partial<IProjectMembershipContext> = {}) =>
  buildProjectAccess({
    teamRole: TEAM_ROLE_NAMES.MEMBER,
    isGuest: false,
    isActive: true,
    accessLevel: "MEMBER",
    financeAccess: false,
    canCreateProjectsFromTemplates: false,
    isProjectMember: true,
    ...overrides,
  });

describe("canViewClientTeamValidator", () => {
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    (mockedDb.query as jest.Mock).mockReset();
    mockedGetProjectAccess.mockReset();
    next = jest.fn();
  });

  it("allows an ordinary project member when members_can_view_client_team is enabled", async () => {
    mockedGetProjectAccess.mockResolvedValueOnce(memberAccess());
    (mockedDb.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ members_can_view_client_team: true }],
    });

    const res = makeRes();
    await canViewClientTeamValidator(makeReq(), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(mockedDb.query).toHaveBeenCalledWith(
      expect.stringContaining("members_can_view_client_team"),
      [PROJECT_ID, TEAM_ID]
    );
  });

  it("rejects an ordinary project member when members_can_view_client_team is disabled", async () => {
    mockedGetProjectAccess.mockResolvedValueOnce(memberAccess());
    (mockedDb.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ members_can_view_client_team: false }],
    });

    const res = makeRes();
    await canViewClientTeamValidator(makeReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows a Team Lead without checking the project setting", async () => {
    mockedGetProjectAccess.mockResolvedValueOnce(
      memberAccess({ teamRole: TEAM_ROLE_NAMES.TEAM_LEAD })
    );

    const res = makeRes();
    await canViewClientTeamValidator(makeReq(), res, next);

    expect(next).toHaveBeenCalled();
    expect(mockedDb.query).not.toHaveBeenCalled();
  });

  it("rejects users who are not project members", async () => {
    mockedGetProjectAccess.mockResolvedValueOnce(
      memberAccess({ isProjectMember: false })
    );

    const res = makeRes();
    await canViewClientTeamValidator(makeReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mockedDb.query).not.toHaveBeenCalled();
  });
});
