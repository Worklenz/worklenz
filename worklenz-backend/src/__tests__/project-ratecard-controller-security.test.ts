import db from "../config/db";
import ProjectRateCardController from "../controllers/project-ratecard-controller";
import { createMockRequest, createMockResponse } from "../tests/utils/express-mock";

jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../decorators/handle-exceptions", () => ({ __esModule: true, default: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) => descriptor }));

describe("project rate card update", () => {
  it("rejects a body project different from the authorized path", async () => {
    const res = createMockResponse();
    await ProjectRateCardController.updateByProjectId(createMockRequest({ params: { project_id: "allowed" }, body: { project_id: "foreign", roles: [{ job_title_id: "role", rate: 1 }] } }), res);
    expect(res.statusCode).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });
});
