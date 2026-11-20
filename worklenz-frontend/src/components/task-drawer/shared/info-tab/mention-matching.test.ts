import { afterEach, describe, expect, it, vi } from 'vitest';
import { findMentionRanges, removeActiveMentionQuery } from './mention-matching';

const members = [{ id: '1', name: 'Ann' }, { id: '2', name: 'Ann Smith' }];

describe('mention matching', () => {
  afterEach(() => vi.restoreAllMocks());

  it('preserves mention boundaries when excluding the active query', () => {
    const withoutQuery = removeActiveMentionQuery('@Ann @Smith', 5, 6);
    expect(findMentionRanges(withoutQuery, members)).toEqual([{ start: 0, length: 4 }]);
  });

  it('maps expanded Unicode text to original offsets', () => {
    expect(findMentionRanges('İ @Ann', members)).toEqual([{ start: 2, length: 4 }]);
  });

  it('preserves context-sensitive Greek casing', () => {
    expect(findMentionRanges('@ΝΊΚΟΣ', [{ id: '3', name: 'Νίκος' }])).toEqual([
      { start: 0, length: 6 },
    ]);
  });

  it('recognizes mentions in quotes while rejecting name suffixes', () => {
    expect(findMentionRanges('"@Ann" @Annette', members)).toEqual([{ start: 1, length: 4 }]);
  });

  it('handles long descriptions without repeatedly normalizing prefixes', () => {
    const lower = String.prototype.toLocaleLowerCase;
    const spy = vi.spyOn(String.prototype, 'toLocaleLowerCase').mockImplementation(function (this: string) {
      return lower.call(this);
    });
    const text = `${'x'.repeat(50000)} @Ann`;
    expect(findMentionRanges(text, members)).toEqual([{ start: 50001, length: 4 }]);
    const totalInputLength = spy.mock.contexts.reduce<number>((sum, value) => sum + String(value).length, 0);
    expect(totalInputLength).toBeLessThan(text.length * 3);
  });

  it('maps Lithuanian contextual expansions to original offsets', () => {
    const lower = String.prototype.toLocaleLowerCase;
    vi.spyOn(String.prototype, 'toLocaleLowerCase').mockImplementation(function (this: string) {
      return lower.call(this, 'lt');
    });
    expect(findMentionRanges('I\u0301 @Ann\n@', members)).toEqual([{ start: 3, length: 4 }]);
  });
});
