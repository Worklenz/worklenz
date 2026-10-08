import auditLogAccessValidator from "../middlewares/validators/audit-log-access-validator";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

describe("auditLogAccessValidator", () => {
  it("calls next() for an Owner", () => {
    const req = createMockRequest({ user: { id: "u1", owner: true } });
    const res = createMockResponse();
    const next = jest.fn();

    auditLogAccessValidator(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("calls next() for an Admin", () => {
    const req = createMockRequest({ user: { id: "u1", is_admin: true } });
    const res = createMockResponse();
    const next = jest.fn();

    auditLogAccessValidator(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("responds 403 (not 401) for a regular Member", () => {
    const req = createMockRequest({ user: { id: "u1", is_member: true } });
    const res = createMockResponse();
    const next = jest.fn();

    auditLogAccessValidator(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.done).toBe(false);
  });

  it("responds 403 when there is no authenticated user at all", () => {
    const req = createMockRequest({ user: undefined });
    const res = createMockResponse();
    const next = jest.fn();

    auditLogAccessValidator(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
