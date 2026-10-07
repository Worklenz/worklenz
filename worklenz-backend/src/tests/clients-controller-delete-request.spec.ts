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

describe("ClientsController.deleteClientRequest", () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it("returns 404 when the request does not belong to the caller's team", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([]));
    const res = createMockResponse();

    await ClientsController.deleteClientRequest(
      createMockRequest({ params: { id: "req-1" } }),
      res
    );

    expect(res.statusCode).toBe(404);
    expect(res.body.done).toBe(false);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  it("blocks deletion and reports why when the request already has invoices", async () => {
    mockedQuery
      .mockResolvedValueOnce(createQueryResult([{ id: "req-1" }]))
      .mockResolvedValueOnce(createQueryResult([{ count: "2" }]));
    const res = createMockResponse();

    await ClientsController.deleteClientRequest(
      createMockRequest({ params: { id: "req-1" } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.done).toBe(false);
    expect(res.body.message).toMatch(/invoices/i);
    // Only the existence and invoice-count checks ran — no delete was attempted.
    expect(mockedQuery).toHaveBeenCalledTimes(2);
  });

  it("deletes the request once it has no invoices against it", async () => {
    mockedQuery
      .mockResolvedValueOnce(createQueryResult([{ id: "req-1" }]))
      .mockResolvedValueOnce(createQueryResult([{ count: "0" }]))
      .mockResolvedValueOnce(createQueryResult([], 1));
    const res = createMockResponse();

    await ClientsController.deleteClientRequest(
      createMockRequest({ params: { id: "req-1" } }),
      res
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.done).toBe(true);
    const [deleteSql, deleteParams] = mockedQuery.mock.calls[2];
    expect(deleteSql).toContain("DELETE FROM client_portal_requests");
    expect(deleteParams).toEqual(["req-1", "team-123"]);
  });

  it("reports a failure instead of throwing", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockedQuery.mockRejectedValueOnce(new Error("db down"));
    const res = createMockResponse();

    await ClientsController.deleteClientRequest(
      createMockRequest({ params: { id: "req-1" } }),
      res
    );

    // @HandleExceptions() always sends 200 with done:false on an unrecognised error —
    // it never lets the raw exception surface as a 5xx.
    expect(res.statusCode).toBe(200);
    expect(res.body.done).toBe(false);
  });
});
