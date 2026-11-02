jest.unmock("../shared/organization-permissions");
jest.unmock("../shared/team-permissions");
jest.unmock("../middlewares/validators/organization-permission-validator");

import { NextFunction } from "express";
import {
  adminCenterAccessValidator,
  manageBillingValidator,
  manageClientsValidator,
} from "../middlewares/validators/organization-permission-validator";
import { ORGANIZATION_PERMISSIONS } from "../shared/organization-permissions";
import { IPassportSession } from "../interfaces/passport-session";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import db from "../config/db";

const mockedDb = db as jest.Mocked<typeof db>;

const memberUser = {
  team_id: "team-1",
  owner: false,
  is_admin: false,
  is_guest: false,
} as unknown as IPassportSession;

const makeReq = (user: IPassportSession | undefined, method = "GET"): IWorkLenzRequest =>
  ({ user, method } as unknown as IWorkLenzRequest);

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

describe("organization permission validators", () => {
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    (mockedDb.query as jest.Mock).mockReset();
    next = jest.fn();
  });

  it("manageBillingValidator allows a Member with Manage billing", async () => {
    (mockedDb.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ permission: ORGANIZATION_PERMISSIONS.MANAGE_BILLING, granted: true }],
    });

    const res = makeRes();
    await manageBillingValidator(makeReq(memberUser), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("manageBillingValidator rejects a Member without Manage billing", async () => {
    (mockedDb.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const res = makeRes();
    await manageBillingValidator(makeReq(memberUser), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("manageClientsValidator allows portal writes when Manage clients is granted", async () => {
    (mockedDb.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ permission: ORGANIZATION_PERMISSIONS.MANAGE_CLIENTS, granted: true }],
    });

    const res = makeRes();
    await manageClientsValidator(makeReq(memberUser, "PUT"), res, next);

    expect(next).toHaveBeenCalled();
  });

  it("adminCenterAccessValidator allows any Admin Center Manage permission", async () => {
    (mockedDb.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ permission: ORGANIZATION_PERMISSIONS.MANAGE_USERS, granted: true }],
    });

    const res = makeRes();
    await adminCenterAccessValidator(makeReq(memberUser), res, next);

    expect(next).toHaveBeenCalled();
  });

  it("adminCenterAccessValidator rejects members with no Manage permissions", async () => {
    (mockedDb.query as jest.Mock).mockResolvedValue({ rows: [] });

    const res = makeRes();
    await adminCenterAccessValidator(makeReq(memberUser), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
