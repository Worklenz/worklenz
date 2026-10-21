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

  it('preserves existing contrast selection when no backdrop is provided', () => {
    expect(getContrastColor('#00000080')).toBe('#FFFFFF');
  });

  it.each([
    ['#FFFFFF', '#000000'],
    ['#1F1F1F', '#FFFFFF'],
  ])('composites translucent colors over %s', (backdrop, expected) => {
    expect(getContrastColor('#00000080', backdrop)).toBe(expected);
  });
});
