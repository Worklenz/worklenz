jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock("../services/token-service", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("../shared/email", () => ({
  __esModule: true,
  sendEmail: jest.fn(),
  sendEmailEnhanced: jest.fn(),
  EmailRequest: jest.fn(),
}));

jest.mock("../shared/email-templates", () => ({
  __esModule: true,
  sendNewSubscriberNotification: jest.fn(),
}));

jest.mock("../shared/email-notifications", () => ({
  __esModule: true,
  sendClientPortalRequestCommentNotification: jest.fn(),
}));

jest.mock("../shared/storage", () => ({
  __esModule: true,
  uploadBase64: jest.fn(),
  deleteObject: jest.fn(),
  getClientPortalStorageKey: jest.fn(),
}));

jest.mock("../cron_jobs/helpers", () => ({
  __esModule: true,
  getClientPortalBaseUrl: jest.fn(),
}));

jest.mock("../shared/io", () => ({
  __esModule: true,
  IO: {},
}));

import db from "../config/db";
import ClientsController from "../controllers/clients-controller";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

const mockedQuery = db.query as jest.Mock;

const request = () => createMockRequest({ params: { id: "client-1" }, user: { id: "u1", team_id: "team-1" } });

describe("ClientsController.deleteById (Settings > Clients)", () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it("refuses to hard-delete a client that is part of the Client Portal, and deletes nothing", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ in_portal: true }]));
    const res = createMockResponse();

    await ClientsController.deleteById(request(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ done: false, body: { code: "PORTAL_CLIENT" } });
    expect(res.body.message).toMatch(/Client Portal > Clients/);
    // Only the footprint check ran: a bare DELETE would cascade away users, approvals and discussions.
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(String(mockedQuery.mock.calls[0][0])).not.toMatch(/DELETE FROM clients/);
  });

  it("scopes the footprint check to the caller's own team", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ in_portal: false }])).mockResolvedValueOnce(createQueryResult([], 1));

    await ClientsController.deleteById(request(), createMockResponse());

    expect(mockedQuery.mock.calls[0][1]).toEqual(["client-1", "team-1"]);
    expect(mockedQuery.mock.calls[1][1]).toEqual(["client-1", "team-1"]);
  });

  it("still deletes a plain project client that has no portal footprint", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ in_portal: false }])).mockResolvedValueOnce(createQueryResult([], 1));
    const res = createMockResponse();

    await ClientsController.deleteById(request(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.done).toBe(true);
    expect(String(mockedQuery.mock.calls[1][0])).toMatch(/DELETE FROM clients WHERE id = \$1 AND team_id = \$2/);
  });

  it("answers the same 409, not a raw 500, when a foreign key still points at the client", async () => {
    mockedQuery
      .mockResolvedValueOnce(createQueryResult([{ in_portal: false }]))
      .mockRejectedValueOnce(Object.assign(new Error("fk"), { code: "23503" }));
    const res = createMockResponse();

    await ClientsController.deleteById(request(), res);

    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ done: false, body: { code: "PORTAL_CLIENT" } });
  });
});
