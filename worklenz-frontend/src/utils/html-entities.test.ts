import { describe, it, expect } from 'vitest';
import { decodeHtmlEntities, safeTextDisplay, decodeHtmlEntitiesFallback } from './html-entities';

describe('decodeHtmlEntities', () => {
  it('decodes apostrophe entities', () => {
    expect(decodeHtmlEntities('John&#x27;s Task')).toBe("John's Task");
    expect(decodeHtmlEntities('John&#39;s Task')).toBe("John's Task");
    expect(decodeHtmlEntities('John&apos;s Task')).toBe("John's Task");
  });

  it('decodes ampersand entity', () => {
    expect(decodeHtmlEntities('Company &amp; Corporation')).toBe('Company & Corporation');
  });

  it('decodes quote entity', () => {
    expect(decodeHtmlEntities('Quote: &quot;Important&quot;')).toBe('Quote: "Important"');
  });

  it('decodes less-than and greater-than entities', () => {
    expect(decodeHtmlEntities('Category: &lt;Important&gt;')).toBe('Category: <Important>');
  });

  it('returns plain text unchanged', () => {
    expect(decodeHtmlEntities('Plain text')).toBe('Plain text');
  });

  it('returns empty string for empty input', () => {
    expect(decodeHtmlEntities('')).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(decodeHtmlEntities(undefined)).toBe('');
  });

  it('returns empty string for null', () => {
    expect(decodeHtmlEntities(null as any)).toBe('');
  });
});

describe('safeTextDisplay', () => {
  it('is an alias for decodeHtmlEntities', () => {
    expect(safeTextDisplay('Task &amp; Project')).toBe('Task & Project');
    expect(safeTextDisplay(undefined)).toBe('');
  });
});

describe('decodeHtmlEntitiesFallback', () => {
  it('decodes &amp;', () => {
    expect(decodeHtmlEntitiesFallback('A &amp; B')).toBe('A & B');
  });

  it('decodes &#x27; and &#39;', () => {
    expect(decodeHtmlEntitiesFallback('it&#x27;s')).toBe("it's");
    expect(decodeHtmlEntitiesFallback('it&#39;s')).toBe("it's");
  });

  it('decodes &quot;', () => {
    expect(decodeHtmlEntitiesFallback('say &quot;hi&quot;')).toBe('say "hi"');
  });

  it('decodes &lt; and &gt;', () => {
    expect(decodeHtmlEntitiesFallback('&lt;tag&gt;')).toBe('<tag>');
  });

  it('returns empty string for empty input', () => {
    expect(decodeHtmlEntitiesFallback('')).toBe('');
  });
});
