jest.unmock("../middlewares/validators/task-duplicate-body-validator");

import validateDuplicateTaskBody from "../middlewares/validators/task-duplicate-body-validator";

const validOptions = {
  subtasks: true,
  attachments: false,
  dates: true,
  dependencies: true,
  assignees: true,
  labels: true,
  customFields: true,
  subscribers: false,
};

const createResponse = () => {
  const response = {
    status: jest.fn(),
    send: jest.fn(),
  } as any;
  response.status.mockReturnValue(response);
  return response;
};

describe("task duplicate body validator", () => {
  it("accepts a valid optional destination project", () => {
    const response = createResponse();
    const next = jest.fn();

    validateDuplicateTaskBody(
      {
        body: {
          task_id: "task-id",
          project_id: "source-project-id",
          destination_project_id: "destination-project-id",
          options: validOptions,
        },
      } as any,
      response,
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it("rejects a non-string destination project", () => {
    const response = createResponse();
    const next = jest.fn();

    validateDuplicateTaskBody(
      {
        body: {
          task_id: "task-id",
          project_id: "source-project-id",
          destination_project_id: 123,
          options: validOptions,
        },
      } as any,
      response,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledTimes(1);
  });

  it("continues to require the options object", () => {
    const response = createResponse();
    const next = jest.fn();

    validateDuplicateTaskBody(
      {
        body: {
          task_id: "task-id",
          project_id: "source-project-id",
          destination_project_id: "destination-project-id",
        },
      } as any,
      response,
      next
    );

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.send).toHaveBeenCalledTimes(1);
  });
});
