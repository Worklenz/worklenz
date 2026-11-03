import { sanitizePlainText } from "../shared/utils";

describe("sanitizePlainText", () => {
  it("strips tags and escapes HTML-sensitive text", () => {
    expect(sanitizePlainText("<b>Task</b> & item")).toBe("Task &amp; item");
  });

  it("keeps entity-encoded markup inert for HTML email sinks", () => {
    const encodedMarkup = "&lt;img src=x&gt;";

    expect(sanitizePlainText(encodedMarkup)).toBe(encodedMarkup);
  });
});
