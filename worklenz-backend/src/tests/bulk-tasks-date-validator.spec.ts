import i18next from "i18next";
import bulkTasksDueDateValidator, {bulkTasksStartDateValidator} from "../middlewares/validators/bulk-tasks-due-date-validator";
import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

const validate = (body: Record<string, unknown>, validator = bulkTasksStartDateValidator) => {
  const response = {status: jest.fn(), send: jest.fn()};
  response.status.mockReturnValue(response);
  const next = jest.fn();
  validator({body} as IWorkLenzRequest, response as unknown as IWorkLenzResponse, next);
  return {response, next};
};

beforeAll(async () => {
  await i18next.init({lng: "en", resources: {}});
});

describe("bulk task date validation", () => {
  it.each([null, "", "2026-10-22", "2026-10-22T00:00:00+05:30", "2026-10-21T18:30:00.000Z"])("accepts explicit start date %s", start_date => {
    const {response, next} = validate({start_date, tasks: [{id: "task-id"}]});
    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it.each([123, false, {}, [], "not-a-date", "2026-02-30", "2026-13-01", "2026-10-22T25:00:00Z", "2026-10", "2026-W43-4", "2026-10-22T00:00:00+99:99"])("rejects invalid start date %p", start_date => {
    const {response, next} = validate({start_date, tasks: []});
    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({done: false, message: "Invalid start date format"}));
  });

  it("rejects omitted start dates instead of clearing tasks", () => {
    const {response, next} = validate({tasks: []});
    expect(next).not.toHaveBeenCalled();
    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({message: "Start date is required"}));
  });

  it("keeps start dates optional for the due-date validator", () => {
    expect(validate({end_date: "2026-10-22", tasks: []}, bulkTasksDueDateValidator).next).toHaveBeenCalled();
    expect(validate({end_date: null, tasks: []}, bulkTasksDueDateValidator).next).toHaveBeenCalled();
  });

  it("continues to reject invalid due-date types and task arrays", () => {
    expect(validate({end_date: 123, tasks: []}, bulkTasksDueDateValidator).response.status).toHaveBeenCalledWith(400);
    expect(validate({start_date: null, tasks: "task-id"}).response.status).toHaveBeenCalledWith(400);
  });
});
