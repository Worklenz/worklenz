import hpp from "hpp";
import { tasksHpp } from "../routes/apis/home-page-api-router";

describe("tasksHpp parameter pollution handling", () => {
  const globalHpp = hpp();

  it("restores whitelisted query array parameters while collapsing non-whitelisted ones", () => {
    const req: any = {
      query: {
        status: ["todo", "done"],
        priority_ids: ["p1", "p2"],
        project_ids: ["proj1", "proj2"],
        assignee_ids: ["a1", "a2"],
        other_field: ["val1", "val2"],
      },
    };
    const res: any = {};

    // 1. Simulate global HPP in app.ts
    globalHpp(req, res, () => {});
    expect(req.query.status).toBe("done");
    expect(req.query.priority_ids).toBe("p2");
    expect(req.query.other_field).toBe("val2");
    expect(req.queryPolluted.status).toEqual(["todo", "done"]);

    // 2. Simulate route-level tasksHpp in home-page-api-router.ts
    tasksHpp(req, res, () => {});
    expect(req.query.status).toEqual(["todo", "done"]);
    expect(req.query.priority_ids).toEqual(["p1", "p2"]);
    expect(req.query.project_ids).toEqual(["proj1", "proj2"]);
    expect(req.query.assignee_ids).toEqual(["a1", "a2"]);
    // Non-whitelisted field remains collapsed to single value
    expect(req.query.other_field).toBe("val2");
  });
});
