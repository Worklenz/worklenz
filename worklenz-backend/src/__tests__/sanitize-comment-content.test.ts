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
});
