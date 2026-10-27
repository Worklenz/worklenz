import { sanitizeCommentContent } from "../shared/utils";

describe("sanitizeCommentContent", () => {
  it("allows safe formatting and checklist tags", () => {
    const input = '<b>Bold</b> <i>Italic</i> <ul data-type="taskList"><li data-type="taskItem" data-checked="true" class="rich-task-item is-checked"><input type="checkbox" checked /><div>Item</div></li></ul>';
    const output = sanitizeCommentContent(input);
    expect(output).toContain("<b>Bold</b>");
    expect(output).toContain("<i>Italic</i>");
    expect(output).toContain('class="rich-task-item is-checked"');
    expect(output).toContain('type="checkbox"');
  });

  it("restricts class values to the editor allowlist", () => {
    const input = '<span class="mention fixed inset-0">@User</span><div class="rich-task-item-content evil">Text</div><blockquote class="rich-blockquote rogue">Quote</blockquote>';
    const output = sanitizeCommentContent(input);
    expect(output).toContain('class="mention"');
    expect(output).not.toContain("fixed");
    expect(output).not.toContain("inset-0");
    expect(output).toContain('class="rich-task-item-content"');
    expect(output).not.toContain("evil");
    expect(output).toContain('class="rich-blockquote"');
    expect(output).not.toContain("rogue");
  });

  it("removes classes from tags not in the allowlist", () => {
    const input = '<ol class="malicious" start="1"><li>Numbered</li></ol><p class="spoofed">Paragraph</p>';
    const output = sanitizeCommentContent(input);
    expect(output).not.toContain("malicious");
    expect(output).toContain('start="1"');
    expect(output).not.toContain("spoofed");
  });

  it("rejects protocol-relative links to prevent open redirects", () => {
    const input = '<a href="//evil.example/phish">Click</a>';
    const output = sanitizeCommentContent(input);
    expect(output).not.toContain("//evil.example");
    expect(output).not.toContain("href");
  });

  it("keeps absolute http(s) links and same-origin relative links", () => {
    const input = '<a href="https://example.com">A</a><a href="/docs">B</a><a href="mailto:a@example.com">C</a>';
    const output = sanitizeCommentContent(input);
    expect(output).toContain('href="https://example.com"');
    expect(output).toContain('href="/docs"');
    expect(output).toContain('href="mailto:a@example.com"');
  });

  it("restricts inline styles to validated color declarations", () => {
    const input =
      '<span style="color:#1890ff;position:fixed;top:0;left:0;z-index:99999">A</span>' +
      '<span style="background:url(//evil.example/pixel.png)">B</span>' +
      '<span style="width:expression(alert(1))">C</span>';
    const output = sanitizeCommentContent(input);
    expect(output).toContain("#1890ff");
    expect(output).not.toContain("position");
    expect(output).not.toContain("z-index");
    expect(output).not.toContain("url(");
    expect(output).not.toContain("expression");
  });

  it("drops style attributes from div tags", () => {
    const input = '<div style="color:#1890ff;position:fixed">Pinned</div>';
    const output = sanitizeCommentContent(input);
    expect(output).not.toContain("style");
    expect(output).not.toContain("position");
  });

  it("forces checklist labels to contenteditable=false", () => {
    const input = '<label contenteditable="true"><input type="checkbox">Item</label>';
    const output = sanitizeCommentContent(input);
    expect(output).not.toContain('contenteditable="true"');
    expect(output).toContain('type="checkbox"');
  });

  it("keeps inputs strictly as checkboxes", () => {
    const input = '<input type="text" /><input type="checkbox" checked />';
    const output = sanitizeCommentContent(input);
    expect(output).not.toContain('type="text"');
    expect(output).toContain('type="checkbox"');
  });
});
