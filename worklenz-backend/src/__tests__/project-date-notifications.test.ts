import { IO } from "../shared/io";
import { notifyProjectDateChanges } from "../shared/project-date-notifications";
import { SocketEvents } from "../socket.io/events";

jest.mock("../shared/io", () => ({ IO: { getInstance: jest.fn() } }));

describe("project date notifications", () => {
  it("broadcasts changed and cleared dates to both rooms once", () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ to: jest.fn().mockReturnValue({ emit }), emit });
    jest.mocked(IO.getInstance).mockReturnValue({ to } as unknown as ReturnType<typeof IO.getInstance>);

    notifyProjectDateChanges("project", "owner", {
      start_date: "2026-01-01", end_date: "2026-01-31",
    }, {
      start_date: "2026-01-02", end_date: null,
    });

    expect(to).toHaveBeenCalledWith("project");
    expect(to.mock.results[0].value.to).toHaveBeenCalledWith("reporting:owner");
    expect(emit).toHaveBeenCalledWith(SocketEvents.PROJECT_START_DATE_CHANGE.toString(), {
      project_id: "project", start_date: "2026-01-02",
    });
    expect(emit).toHaveBeenCalledWith(SocketEvents.PROJECT_END_DATE_CHANGE.toString(), {
      project_id: "project", end_date: null,
    });
    expect(emit).toHaveBeenCalledTimes(2);
  });

  it("does not broadcast unchanged dates", () => {
    const emit = jest.fn();
    jest.mocked(IO.getInstance).mockReturnValue({ to: jest.fn().mockReturnValue({ emit }) } as unknown as ReturnType<typeof IO.getInstance>);
    const dates = { start_date: "2026-01-01", end_date: null };
    notifyProjectDateChanges("project", null, dates, dates);
    expect(emit).not.toHaveBeenCalled();
  });
});
