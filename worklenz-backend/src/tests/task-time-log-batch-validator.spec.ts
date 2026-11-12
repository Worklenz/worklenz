jest.mock("../shared/timelog-project-date-restriction", () => ({
  getProjectStartDateViolation: jest.fn(),
}));
jest.mock("../shared/timelog-backdate-restriction", () => ({
  getBackdateViolation: jest.fn(),
}));

import taskTimeLogValidator from "../middlewares/validators/task-time-log-validator";
import { getProjectStartDateViolation } from "../shared/timelog-project-date-restriction";
import { getBackdateViolation } from "../shared/timelog-backdate-restriction";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

describe("batch time log validation", () => {
  const entry = { id: "task-1", seconds_spent: 60, formatted_start: "2026-11-12T00:00:00Z" };

  beforeEach(() => jest.clearAllMocks());

  it.each([
    { id: "task-1", entries: [entry, { ...entry, id: "other-task" }] },
    { id: "task-1", entries: Array.from({ length: 21 }, () => entry) },
    { entries: [entry] },
  ])("rejects invalid batches before database validation", async body => {
    const res = createMockResponse();
    const next = jest.fn();
    await taskTimeLogValidator(createMockRequest({ body }), res, next);
    expect(res.sendStatus).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
    expect(getProjectStartDateViolation).not.toHaveBeenCalled();
    expect(getBackdateViolation).not.toHaveBeenCalled();
  });

  it("accepts a same-task batch and validates each date", async () => {
    const res = createMockResponse();
    const next = jest.fn();
    await taskTimeLogValidator(createMockRequest({ body: { id: "task-1", entries: [entry, { ...entry, id: undefined }] } }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(getProjectStartDateViolation).toHaveBeenCalledTimes(2);
    expect(getProjectStartDateViolation).toHaveBeenCalledWith(expect.objectContaining({ taskId: "task-1" }));
    expect(getBackdateViolation).toHaveBeenCalledTimes(2);
  });
});
