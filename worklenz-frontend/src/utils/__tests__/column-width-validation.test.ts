import { describe, expect, it } from 'vitest';
import { validateColumnWidth, validateColumnWidths } from '../column-width-validation';

describe('column-width-validation', () => {
  const titleColumn = {
    id: 'title',
    width: '350px',
    minWidth: '200px',
  };

  it('allows the title column to expand beyond the former 400px limit', () => {
    expect(validateColumnWidth('title', '720px', titleColumn)).toBe('720px');
  });

  it('preserves persisted title widths above 400px', () => {
    expect(validateColumnWidths({ title: '640px' }, [titleColumn])).toEqual({
      title: '640px',
    });
  });

  it('continues to enforce configured and column-specific minimum widths', () => {
    expect(
      validateColumnWidth('description', '120px', {
        id: 'description',
        minWidth: '100px',
      })
    ).toBe('200px');

    expect(
      validateColumnWidth('labels', '500px', {
        id: 'labels',
        maxWidth: '400px',
      })
    ).toBe('400px');
  });

  it('clamps custom column widths without base column configuration to 180px-400px range', () => {
    // Clamps below minimum 180px
    expect(validateColumnWidth('custom-col-1', '120px')).toBe('180px');
    expect(validateColumnWidths({ 'custom-col-1': '120px' }, [])).toEqual({
      'custom-col-1': '180px',
    });

    // Preserves valid width in range
    expect(validateColumnWidth('custom-col-2', '250px')).toBe('250px');
    expect(validateColumnWidths({ 'custom-col-2': '250px' }, [])).toEqual({
      'custom-col-2': '250px',
    });

    // Clamps above maximum 400px
    expect(validateColumnWidth('custom-col-3', '550px')).toBe('400px');
    expect(validateColumnWidths({ 'custom-col-3': '550px' }, [])).toEqual({
      'custom-col-3': '400px',
    });
  });
});
