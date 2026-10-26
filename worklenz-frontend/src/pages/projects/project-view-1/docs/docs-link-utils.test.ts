import { describe, expect, it } from 'vitest';
import { normalizeDocsLink } from './docs-link-utils';

describe('document link normalization', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,test',
    'file:///etc/passwd',
    'ftp://example.com',
    'https://',
    'plain text',
    'https://user:password@example.com',
    '//example.com',
    'hello',
  ])('rejects unsupported or invalid address %s', value => {
    expect(normalizeDocsLink(value)).toBeNull();
  });
  it.each([
    ['example.com/docs', 'https://example.com/docs'],
    [' https://example.com/a?q=1#title ', 'https://example.com/a?q=1#title'],
    ['http://example.com', 'http://example.com/'],
  ])('normalizes %s', (value, expected) => {
    expect(normalizeDocsLink(value)).toBe(expected);
  });
});
