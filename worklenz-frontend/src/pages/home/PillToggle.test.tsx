import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PillToggle from './PillToggle';

const renderToggle = (
  options: React.ComponentProps<typeof PillToggle<'a' | 'b'>>['options'],
  onChange = vi.fn()
) => ({
  onChange,
  ...render(
    <PillToggle<'a' | 'b'> value="a" onChange={onChange} options={options} ariaLabel="View" />
  ),
});

describe('PillToggle tooltips', () => {
  it("shows an option's description when the pointer rests on it", async () => {
    const user = userEvent.setup();
    renderToggle([
      { value: 'a', label: 'Flat', tooltip: 'Every entry on its own row.' },
      { value: 'b', label: 'By task', tooltip: 'One row per task.' },
    ]);

    await user.hover(screen.getByRole('radio', { name: 'By task' }));
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('One row per task.');
    expect(screen.queryByText('Every entry on its own row.')).not.toBeInTheDocument();
  });

  it('covers the whole segment, not just its text', async () => {
    const user = userEvent.setup();
    renderToggle([
      { value: 'a', label: 'Flat', tooltip: 'Every entry on its own row.' },
      { value: 'b', label: 'By task' },
    ]);
    // the radio itself (padding included) is the hover target
    await user.hover(screen.getByRole('radio', { name: 'Flat' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Every entry on its own row.');
  });

  it('shows it for keyboard users too, on focus', async () => {
    const user = userEvent.setup();
    renderToggle([
      { value: 'a', label: 'Flat', tooltip: 'Every entry on its own row.' },
      { value: 'b', label: 'By task', tooltip: 'One row per task.' },
    ]);
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Flat' })).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Every entry on its own row.');
  });

  it('adds no tooltip to an option without a description', async () => {
    const user = userEvent.setup();
    renderToggle([
      { value: 'a', label: 'Flat' },
      { value: 'b', label: 'By task' },
    ]);
    await user.hover(screen.getByRole('radio', { name: 'By task' }));
    await new Promise(resolve => setTimeout(resolve, 300));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('still selects and navigates by keyboard with tooltips on every option', async () => {
    const user = userEvent.setup();
    const { onChange } = renderToggle([
      { value: 'a', label: 'Flat', tooltip: 'Every entry on its own row.' },
      { value: 'b', label: 'By task', tooltip: 'One row per task.' },
    ]);

    await user.click(screen.getByRole('radio', { name: 'By task' }));
    expect(onChange).toHaveBeenLastCalledWith('b');

    // arrow keys move to — and focus — the neighbouring radio, which sits right in the group
    screen.getByRole('radio', { name: 'Flat' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('b');
    expect(screen.getByRole('radio', { name: 'By task' })).toHaveFocus();
  });

  it('keeps the radios as direct children of the group, so nothing else shifts', () => {
    renderToggle([
      { value: 'a', label: 'Flat', tooltip: 'Every entry on its own row.' },
      { value: 'b', label: 'By task', tooltip: 'One row per task.' },
    ]);
    const group = screen.getByRole('radiogroup', { name: 'View' });
    expect(Array.from(group.children).map(child => child.getAttribute('role'))).toEqual([
      'radio',
      'radio',
    ]);
  });
});
