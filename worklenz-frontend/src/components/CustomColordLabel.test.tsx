import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CustomColordLabel from './CustomColordLabel';

describe('CustomColordLabel', () => {
  it.each([
    ['#70A6F3', '#000000'],
    ['#154C9B', '#FFFFFF'],
  ])('uses readable text on a %s label background', (color, textColor) => {
    render(<CustomColordLabel label={{ name: 'Launch', color }} />);

    const labelText = screen.getByText('Launch');
    expect(labelText.parentElement).toHaveStyle({
      backgroundColor: color,
      color: textColor,
    });
  });
});
