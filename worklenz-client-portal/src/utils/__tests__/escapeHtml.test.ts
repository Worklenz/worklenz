import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../escapeHtml';

describe('escapeHtml', () => {
  it('should return empty string for undefined and null', () => {
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(null)).toBe('');
  });

  it('should escape HTML tags and special characters', () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert('xss')&lt;/script&gt;"
    );
    expect(escapeHtml('Hello & World')).toBe('Hello &amp; World');
    expect(escapeHtml('"Quotes" & <Tags>')).toBe(
      '"Quotes" &amp; &lt;Tags&gt;'
    );
  });

  it('should preserve standard safe text unchanged', () => {
    expect(escapeHtml('Simple string 12345')).toBe('Simple string 12345');
    expect(escapeHtml('client@worklenz.com')).toBe('client@worklenz.com');
  });
});
