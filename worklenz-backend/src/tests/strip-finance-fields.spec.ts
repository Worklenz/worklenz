/**
 * Phase 4 — strip-finance-fields helpers.
 */

jest.unmock("../../shared/strip-finance-fields");

import {
  stripFinanceFromTemplateSettings,
  stripProjectFinanceFields,
  stripTaskFinanceFields,
} from "../../shared/strip-finance-fields";

describe("strip-finance-fields", () => {
  it("leaves project fields when finance access is on", () => {
    const project = { id: "p1", budget: 1000, currency: "USD" };
    expect(stripProjectFinanceFields(project, true)).toEqual(project);
  });

  it("nulls budget when finance access is off", () => {
    const project = { id: "p1", budget: 1000, currency: "USD", name: "A" };
    expect(stripProjectFinanceFields(project, false)).toEqual({
      id: "p1",
      budget: null,
      currency: "USD",
      name: "A",
    });
  });

  it("strips task cost fields when finance access is off", () => {
    const task = { id: "t1", name: "Task", fixed_cost: 50, actual_cost: 20 };
    expect(stripTaskFinanceFields(task, false)).toEqual({
      id: "t1",
      name: "Task",
    });
  });

  it("removes budget from template settings when finance access is off", () => {
    const settings = {
      category_id: "c1",
      budget: { amount: 100, currency: "USD" },
    };
    expect(stripFinanceFromTemplateSettings(settings, false)).toEqual({
      category_id: "c1",
    });
  });
});
