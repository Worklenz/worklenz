import db from "../config/db";
import PtTaskPhasesController from "../controllers/project-templates/pt-task-phases-controller";
import { verifyTemplateReadAccess, verifyTemplateWriteAccess } from "../middlewares/verify-template-access";
import { createMockRequest, createMockResponse } from "../tests/utils/express-mock";
import { createQueryResult } from "../tests/utils/db-mock";

jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../decorators/handle-exceptions", () => ({
  __esModule: true,
  default: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) => descriptor
}));

const query = db.query as jest.MockedFunction<typeof db.query>;
const user = { id: "user-123", team_id: "team-123", is_guest: false };
const templateId = "b1234567-89ab-cdef-0123-456789abcdef";
const phaseId = "a1234567-89ab-cdef-0123-456789abcdef";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("verifyTemplateWriteAccess", () => {
  it("denies access if unauthenticated", async () => {
    const res = createMockResponse();
    const next = jest.fn();
    await verifyTemplateWriteAccess("query", "id")(createMockRequest({ user: undefined }), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("denies access if template does not belong to user's team or user is guest", async () => {
    query.mockResolvedValueOnce(createQueryResult([]));
    const res = createMockResponse();
    const next = jest.fn();
    await verifyTemplateWriteAccess("query", "id")(
      createMockRequest({ user, query: { id: templateId } }),
      res,
      next
    );
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows access when template belongs to user's active team", async () => {
    query.mockResolvedValueOnce(createQueryResult([{ id: templateId }]));
    const res = createMockResponse();
    const next = jest.fn();
    await verifyTemplateWriteAccess("query", "id")(
      createMockRequest({ user, query: { id: templateId } }),
      res,
      next
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("PtTaskPhasesController cross-tenant security", () => {
  it("create: rejects when template is not in user's team", async () => {
    query.mockResolvedValueOnce(createQueryResult([])); // INSERT ... RETURNING id
    const res = createMockResponse();
    await PtTaskPhasesController.create(
      createMockRequest({ user, query: { id: templateId }, body: {} }),
      res
    );
    expect(res.statusCode).toBe(403);
    expect(query.mock.calls[0][0]).toContain("custom_project_templates cpt");
    expect(query.mock.calls[0][1]).toEqual(["#fbc84c", templateId, "team-123"]);
  });

  it("updateLabel: rejects when template is not in user's team", async () => {
    query.mockResolvedValueOnce(createQueryResult([])); // UPDATE ... RETURNING id
    const res = createMockResponse();
    await PtTaskPhasesController.updateLabel(
      createMockRequest({ user, params: { id: templateId }, body: { name: "Sprint" } }),
      res
    );
    expect(res.statusCode).toBe(404);
    expect(query.mock.calls[0][0]).toContain("WHERE id = $1 AND team_id = $3");
    expect(query.mock.calls[0][1]).toEqual([templateId, "Sprint", "team-123"]);
  });

  it("deleteById: rejects when template phase is not in user's team", async () => {
    query.mockResolvedValueOnce(createQueryResult([])); // DELETE ... RETURNING id
    const res = createMockResponse();
    await PtTaskPhasesController.deleteById(
      createMockRequest({ user, params: { id: phaseId }, query: { id: templateId } }),
      res
    );
    expect(res.statusCode).toBe(404);
    expect(query.mock.calls[0][0]).toContain("template_id IN (SELECT id FROM custom_project_templates WHERE team_id = $3)");
    expect(query.mock.calls[0][1]).toEqual([phaseId, templateId, "team-123"]);
  });

  it("deleteById: deletes successfully when template phase belongs to user's team", async () => {
    query.mockResolvedValueOnce(createQueryResult([{ id: phaseId }])); // DELETE ... RETURNING id
    const res = createMockResponse();
    await PtTaskPhasesController.deleteById(
      createMockRequest({ user, params: { id: phaseId }, query: { id: templateId } }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.body).toEqual([{ id: phaseId }]);
  });
});
