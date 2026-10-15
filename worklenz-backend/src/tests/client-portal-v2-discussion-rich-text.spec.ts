jest.mock("../shared/slack", () => ({ __esModule: true, send_to_slack: jest.fn() }));

import { htmlToPlainText, sanitizeDiscussionHtml } from "../shared/utils";

describe("sanitizeDiscussionHtml", () => {
  it("keeps the formatting the composer produces", () => {
    const html = '<h1>Title</h1><p><strong>bold</strong> <em>it</em></p><ul><li>one</li></ul><ol><li>two</li></ol>';
    expect(sanitizeDiscussionHtml(html)).toBe(html);
  });

  it("keeps a mention chip with its id", () => {
    const html = '<p><span class="mention" data-type="mention" data-id="u1" data-label="Ann">@Ann</span> hi</p>';
    expect(sanitizeDiscussionHtml(html)).toBe(html);
  });

  it("drops scripts, event handlers, styles and unsafe links", () => {
    const out = sanitizeDiscussionHtml(
      '<p onclick="x()" style="position:fixed">a</p><script>alert(1)</script><a href="javascript:alert(1)">l</a><img src=x onerror=y>'
    );
    expect(out).not.toMatch(/script|onclick|style|javascript:|<img/i);
  });

  it("makes links open safely", () => {
    expect(sanitizeDiscussionHtml('<a href="https://example.com">x</a>')).toContain('rel="noopener noreferrer nofollow"');
  });
});

describe("htmlToPlainText", () => {
  it("flattens blocks into readable text", () => {
    expect(htmlToPlainText("<h1>Hi</h1><p>one <strong>two</strong></p><ul><li>a</li><li>b</li></ul>")).toBe("Hi one two a b");
  });

  it("leaves legacy plain text readable", () => {
    expect(htmlToPlainText("a < b & c\nnext")).toBe("a < b & c next");
  });

  it("is empty for markup without text", () => {
    expect(htmlToPlainText("<p></p><p><br></p>")).toBe("");
  });
});
