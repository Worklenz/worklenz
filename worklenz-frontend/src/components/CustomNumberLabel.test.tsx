import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CustomNumberLabel from './CustomNumberLabel';

describe('CustomNumberLabel', () => {
  it.each([
    ['#75C997', '#000000'],
    ['#154C9B', '#FFFFFF'],
  ])('uses readable text on a %s aggregated-label background', (color, textColor) => {
    render(
      <CustomNumberLabel labelList={['Launch', 'Design']} namesString="2 labels" color={color} />
    );

    expect(screen.getByText('2 labels')).toHaveStyle({
      backgroundColor: color,
      color: textColor,
    });
  });
});
