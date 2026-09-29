import { describe, it, expect } from 'vitest';
import { themeWiseColor } from '../themeWiseColor';

describe('themeWiseColor', () => {
  it('should return lightColor when themeMode is light', () => {
    expect(themeWiseColor('#ffffff', '#000000', 'light')).toBe('#ffffff');
  });

  it('should return darkColor when themeMode is dark', () => {
    expect(themeWiseColor('#ffffff', '#000000', 'dark')).toBe('#000000');
  });
});
