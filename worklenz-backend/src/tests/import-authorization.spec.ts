import ImportsController from "../controllers/imports-controller";
import ImportsService from "../services/imports-service";
import ImportIngestionService from "../services/import-ingestion-service";
import { getProjectAccessForRequest } from "../shared/project-access";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

jest.mock("../shared/safe-controller-function", () => ({ __esModule: true, default: (fn: unknown) => fn }));
jest.mock("../services/imports-service", () => ({ __esModule: true, default: {
  getJobForUser: jest.fn(), createJob: jest.fn(), updateJobTargets: jest.fn(),
  updateJobStatus: jest.fn(), commit: jest.fn(), progress: jest.fn(), deleteTargetProject: jest.fn(),
} }));
jest.mock("../services/import-ingestion-service", () => ({ __esModule: true, default: { ingest: jest.fn() } }));
jest.mock("../shared/project-access", () => ({ getProjectAccessForRequest: jest.fn() }));
jest.mock("../shared/storage", () => ({}));

const service = ImportsService as jest.Mocked<typeof ImportsService>;
const access = getProjectAccessForRequest as jest.MockedFunction<typeof getProjectAccessForRequest>;
const run = async (handler: typeof ImportsController.create, req: ReturnType<typeof createMockRequest>) =>
  (handler as unknown as (req: unknown, res: unknown) => Promise<unknown>)(req, createMockResponse());
const allowed = { teamRole: "Admin", permissions: { tasks: true, statuses: true, phases: true, customColumns: true } };

beforeEach(() => {
  jest.clearAllMocks();
  access.mockResolvedValue(allowed as Awaited<ReturnType<typeof getProjectAccessForRequest>>);
});

describe("import authorization", () => {
  it("does not expose another user's import job", async () => {
    service.getJobForUser.mockResolvedValue(null);
    await expect(run(ImportsController.get, createMockRequest({ params: { jobId: "foreign-job" } }))).rejects.toMatchObject({ status: 404 });
    expect(service.getJobForUser).toHaveBeenCalledWith("foreign-job", "user-123");
  });
  it("rejects creation for a project without import privileges", async () => {
    access.mockResolvedValue({ ...allowed, teamRole: "Member" } as Awaited<ReturnType<typeof getProjectAccessForRequest>>);
    await expect(run(ImportsController.create, createMockRequest({ body: { provider: "jira", flowType: "direct", targetProjectId: "foreign-project" } }))).rejects.toMatchObject({ status: 403 });
    expect(service.createJob).not.toHaveBeenCalled();
  });
  it("does not delete the target project when ingestion fails", async () => {
    service.getJobForUser.mockResolvedValue({ id: "job", target_project_id: "project", flow_type: "direct" } as never);
    (ImportIngestionService.ingest as jest.Mock).mockRejectedValue(new Error("import failed"));
    await expect(run(ImportsController.ingest, createMockRequest({ params: { jobId: "job" } }))).rejects.toMatchObject({ status: 422 });
    expect(service.deleteTargetProject).not.toHaveBeenCalled();
  });
  it("rechecks project access before committing an existing job", async () => {
    service.getJobForUser.mockResolvedValue({ id: "job", target_project_id: "project", status: "ready" } as never);
    access.mockResolvedValue({ ...allowed, permissions: { ...allowed.permissions, tasks: false } } as Awaited<ReturnType<typeof getProjectAccessForRequest>>);
    await expect(run(ImportsController.commit, createMockRequest({ params: { jobId: "job" } }))).rejects.toMatchObject({ status: 403 });
    expect(service.commit).not.toHaveBeenCalled();
  });
});
