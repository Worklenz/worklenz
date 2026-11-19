import { describe, expect, it } from 'vitest';
import { normalizeLanguage } from './language-utils';

describe('normalizeLanguage', () => {
  it('recognizes Italian and its regional variants', () => {
    expect(normalizeLanguage('it')).toBe('it');
    expect(normalizeLanguage('it-IT')).toBe('it');
    expect(normalizeLanguage('it_CH')).toBe('it');
  });
});
