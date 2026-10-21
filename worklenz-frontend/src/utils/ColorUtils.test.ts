import { describe, expect, it } from 'vitest';
import { getContrastColor } from './colorUtils';

describe('getContrastColor', () => {
  it.each([
    ['#FFFFFF', '#000000'],
    ['#000000', '#FFFFFF'],
    ['#F53', '#000000'],
    ['#75C997', '#000000'],
    ['#46D98069', '#000000'],
    ['#8B1A1A', '#FFFFFF'],
  ])('chooses the higher-contrast label color for %s', (background, expected) => {
    expect(getContrastColor(background)).toBe(expected);
  });

  it('falls back to white for colors that cannot be parsed', () => {
    expect(getContrastColor('not-a-color')).toBe('#FFFFFF');
  });
});
