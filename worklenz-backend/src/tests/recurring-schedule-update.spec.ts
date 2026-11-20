const mockClientQuery = jest.fn();

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    pool: { connect: jest.fn(async () => ({ query: mockClientQuery, release: jest.fn() })) },
  },
}));

import TaskRecurringController from "../controllers/task-recurring-controller";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

/** Saves a monthly "Nth weekday" schedule and returns the day_of_month value sent to the UPDATE. */
const savedDayOfMonth = async (dayOfMonth: unknown) => {
  const req = createMockRequest({
    method: "PUT",
    params: { id: "schedule-1" },
    body: { schedule_type: "monthly", day_of_month: dayOfMonth, week_of_month: 1 },
  });
  const res = createMockResponse();
  mockClientQuery.mockReset();

  await TaskRecurringController.updateSchedule(req, res);

  expect(res.statusCode).toBe(200);
  const update = mockClientQuery.mock.calls.find(([sql]) => /UPDATE task_recurring_schedules/.test(String(sql)));
  expect(update).toBeDefined();
  return update?.[1][3]; // $4 = day_of_month
};

describe("TaskRecurringController.updateSchedule - day_of_month", () => {
  it("keeps Sunday (0) when saving a monthly schedule", async () => {
    expect(await savedDayOfMonth(0)).toBe(0);
  });

  it("keeps the other weekdays", async () => {
    expect(await savedDayOfMonth(1)).toBe(1);
    expect(await savedDayOfMonth(6)).toBe(6);
  });

  it("stores null when no weekday is given", async () => {
    expect(await savedDayOfMonth(undefined)).toBeNull();
    expect(await savedDayOfMonth(null)).toBeNull();
  });
});
