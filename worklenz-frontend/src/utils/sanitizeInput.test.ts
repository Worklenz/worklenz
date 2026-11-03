import { afterEach, describe, expect, it, vi } from 'vitest';
import { sanitizeCommentContent } from './sanitizeInput';

describe('sanitizeCommentContent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it('keeps only validated color declarations from style attributes', () => {
    const input =
      '<span style="color: #1890ff; position: fixed; top: 0; left: 0; z-index: 99999;">Text</span>';
    const output = sanitizeCommentContent(input);
    expect(output).toContain('color: #1890ff');
    expect(output).not.toContain('position');
    expect(output).not.toContain('z-index');
  });

  it('strips url(...) payloads from style attributes', () => {
    const input = '<span style="background: url(//evil.example/pixel.png); color: red;">Text</span>';
    const output = sanitizeCommentContent(input);
    expect(output).toContain('color: red');
    expect(output).not.toContain('url(');
    expect(output).not.toContain('evil.example');
  });

  it('strips expression(...) payloads from style attributes', () => {
    const input = '<span style="width: expression(alert(1)); color: green;">Text</span>';
    const output = sanitizeCommentContent(input);
    expect(output).toContain('color: green');
    expect(output).not.toContain('expression');
  });

  it('filters styles on every allowed tag, not just spans', () => {
    const input =
      '<div style="position: fixed; bottom: 0; color: blue;">Pinned</div><b style="display: none; color: red;">Hidden</b>';
    const output = sanitizeCommentContent(input);
    expect(output).not.toContain('position');
    expect(output).not.toContain('display');
    expect(output).toContain('color: blue');
    expect(output).toContain('color: red');
  });

  it('enforces transformations when no global document is available', () => {
    vi.stubGlobal('document', undefined);
    const input =
      '<span class="mention evil" style="color: #1890ff; position: fixed;">@John</span>' +
      '<input type="text" /><a href="https://example.com">Link</a>';
    const output = sanitizeCommentContent(input);
    expect(output).toContain('color: #1890ff');
    expect(output).not.toContain('position');
    expect(output).toContain('class="mention"');
    expect(output).not.toContain('evil');
    expect(output).toContain('type="checkbox"');
    expect(output).toContain('target="_blank"');
    expect(output).toContain('rel="noopener noreferrer nofollow"');
  });

  it('strips protocol-relative URLs from links', () => {
    const input = '<a href="//evil.example/phish">Click</a>';
    const output = sanitizeCommentContent(input);
    expect(output).not.toContain('evil.example');
  });

  it('keeps same-origin relative links but strips backslash and scheme-less host variants', () => {
    expect(sanitizeCommentContent('<a href="/docs/page?x=1">Docs</a>')).toContain('href="/docs/page?x=1"');
    const output = sanitizeCommentContent(
      '<a href="/\\evil.example">A</a><a href="\\\\evil.example">B</a><a href="javascript:alert(1)">C</a>'
    );
    expect(output).not.toContain('evil.example');
    expect(output).not.toContain('javascript');
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
