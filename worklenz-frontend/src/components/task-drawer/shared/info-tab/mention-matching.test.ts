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

  it('maps Lithuanian contextual expansions to original offsets', () => {
    const lower = String.prototype.toLocaleLowerCase;
    vi.spyOn(String.prototype, 'toLocaleLowerCase').mockImplementation(function (this: string) {
      return lower.call(this, 'lt');
    });
    expect(findMentionRanges('I\u0301 @Ann\n@', members)).toEqual([{ start: 3, length: 4 }]);
  });
});
