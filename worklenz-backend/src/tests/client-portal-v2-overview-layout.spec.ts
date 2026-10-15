import { validateLayout } from "../services/client-portal-v2/overview-layout.service";

const grid = (widgets: unknown[]) => ({ version: 1, widgets });
const widget = (over: Record<string, unknown> = {}) => ({
  key: "mentions_me",
  x: 0,
  y: 0,
  w: 6,
  h: 8,
  hidden: false,
  ...over,
});

describe("overview layout validation", () => {
  it("accepts the grid shape", () => {
    const layout = grid([widget(), widget({ key: "cr_by_status", x: 6, hidden: true })]);
    expect(validateLayout(layout)).toEqual(layout);
  });

  it("still accepts the legacy list shape", () => {
    const legacy = [{ key: "mentions_me", size: "m", visible: true }];
    expect(validateLayout(legacy)).toEqual(legacy);
  });

  it.each([
    ["unknown widget", grid([widget({ key: "nope" })])],
    ["duplicate widget", grid([widget(), widget()])],
    ["width out of range", grid([widget({ w: 13 })])],
    ["overflowing the grid", grid([widget({ x: 8, w: 6 })])],
    ["fractional geometry", grid([widget({ h: 2.5 })])],
    ["bad visibility", grid([widget({ hidden: "no" })])],
    ["wrong version", { version: 2, widgets: [] }],
    ["not an object", "layout"],
  ])("rejects %s", (_name, input) => {
    expect(() => validateLayout(input)).toThrow();
  });
});
