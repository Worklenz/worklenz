import { describe, it, expect } from 'vitest';
import { slugifyForBranch } from './CreateBranchModal';

describe('slugifyForBranch', () => {
  it('lowercases and hyphenates', () => {
    expect(slugifyForBranch('Add OAuth login!')).toBe('add-oauth-login');
  });

  it('trims separators and limits length without a trailing dash', () => {
    const slug = slugifyForBranch(
      '  --Fix: the very long title that keeps going and going forever--  '
    );
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.startsWith('-')).toBe(false);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(slugifyForBranch('！！！')).toBe('');
  });
});
