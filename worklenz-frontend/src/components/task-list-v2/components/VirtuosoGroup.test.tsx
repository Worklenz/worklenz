import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VirtuosoGroup } from './VirtuosoGroup';

describe('VirtuosoGroup', () => {
  it('keeps Virtuoso measurement attributes, sticky styles, and group content', () => {
    render(
      <VirtuosoGroup
        data-index={2}
        data-item-index={5}
        data-known-size={48}
        style={{ position: 'sticky', top: 0 }}
      >
        <span>Group header</span>
      </VirtuosoGroup>
    );

    const wrapper = screen.getByText('Group header').parentElement;
    expect(wrapper?.className).toBe('virtuoso-group-header-wrapper');
    expect(wrapper?.getAttribute('data-index')).toBe('2');
    expect(wrapper?.getAttribute('data-item-index')).toBe('5');
    expect(wrapper?.getAttribute('data-known-size')).toBe('48');
    expect(wrapper?.style.position).toBe('sticky');
    expect(wrapper?.style.top).toBe('0px');
  });
});
