import { describe, expect, it } from 'vitest';
import { sanitizeCommentContent } from './sanitizeInput';

describe('sanitizeCommentContent', () => {
  it('allows safe formatting: bold, italic, strike, code, blockquote, lists', () => {
    const input = '<b>Bold</b> <i>Italic</i> <s>Strike</s> <code>inline</code> <blockquote>Quote</blockquote>';
    const output = sanitizeCommentContent(input);
    expect(output).toContain('<b>Bold</b>');
    expect(output).toContain('<i>Italic</i>');
    expect(output).toContain('<s>Strike</s>');
    expect(output).toContain('<code>inline</code>');
    expect(output).toContain('<blockquote>Quote</blockquote>');
  });

  it('allows safe checklists with taskItem and checkboxes', () => {
    const input = '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked /></label><div>Done</div></li></ul>';
    const output = sanitizeCommentContent(input);
    expect(output).toContain('data-type="taskList"');
    expect(output).toContain('data-type="taskItem"');
    expect(output).toContain('type="checkbox"');
  });

  it('allows safe hyperlinks and enforces rel/target', () => {
    const input = '<a href="https://example.com">Visit site</a>';
    const output = sanitizeCommentContent(input);
    expect(output).toContain('href="https://example.com"');
    expect(output).toContain('target="_blank"');
    expect(output).toContain('rel="noopener noreferrer nofollow"');
  });

  it('allows type colors via style or color', () => {
    const input = '<span style="color: #1890ff;">Blue text</span>';
    const output = sanitizeCommentContent(input);
    expect(output).toContain('color: #1890ff');
  });

  it('strips dangerous scripts and malicious event handlers', () => {
    const input = '<script>alert(1)</script><img src="x" onerror="alert(1)" /><a href="javascript:alert(1)">Click</a>';
    const output = sanitizeCommentContent(input);
    expect(output).not.toContain('<script>');
    expect(output).not.toContain('onerror');
    expect(output).not.toContain('javascript:');
  });

  it('restricts classes to the editor allowlist and removes unknown classes', () => {
    const input = '<span class="mention fixed inset-0">@John</span><div class="rich-task-item-content evil-class">content</div><p class="unauthorized">text</p><blockquote class="rich-blockquote">quote</blockquote>';
    const output = sanitizeCommentContent(input);
    expect(output).toContain('class="mention"');
    expect(output).not.toContain('fixed');
    expect(output).not.toContain('inset-0');
    expect(output).toContain('class="rich-task-item-content"');
    expect(output).not.toContain('evil-class');
    expect(output).not.toContain('unauthorized');
    expect(output).toContain('class="rich-blockquote"');
  });
});
