import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiSelectFilterPill } from './MultiSelectFilterPill';

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ themeReducer: { mode: 'light' } }),
}));

const OPTIONS = [
  { value: 'a', label: 'Ates' },
  { value: 'b', label: 'Insolvenz GmbH' },
  { value: 'c', label: 'No client' },
];

const renderPill = (props: Partial<React.ComponentProps<typeof MultiSelectFilterPill>> = {}) => {
  const onChange = vi.fn();
  const utils = render(
    <MultiSelectFilterPill
      label="Client"
      options={OPTIONS}
      value={[]}
      onChange={onChange}
      {...props}
    />
  );
  return { onChange, ...utils };
};

const openPill = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /Client/ }));
  return within((await screen.findByText('Ates')).closest('.ant-card') as HTMLElement);
};

describe('MultiSelectFilterPill', () => {
  it('toggles an option exactly once when its label is clicked', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPill();
    const list = await openPill(user);

    await user.click(list.getByText('Insolvenz GmbH'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('toggles exactly once when the checkbox itself is clicked', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPill();
    const list = await openPill(user);

    await user.click(list.getByRole('checkbox', { name: 'Ates' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('is operable from the keyboard (Space on a focused checkbox)', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPill();
    const list = await openPill(user);

    list.getByRole('checkbox', { name: 'Ates' }).focus();
    await user.keyboard(' ');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('unchecks a selected option, keeping the others', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPill({ value: ['a', 'b'] });
    const list = await openPill(user);

    expect(list.getByRole('checkbox', { name: 'Ates' })).toBeChecked();
    await user.click(list.getByText('Ates'));

    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('shows how many options are selected on the pill', () => {
    renderPill({ value: ['a', 'b'] });
    expect(screen.getByRole('button', { name: /Client/ })).toHaveTextContent('2');
  });

  it('filters the options by the search text, and forgets the search when it closes', async () => {
    const user = userEvent.setup();
    renderPill({ searchPlaceholder: 'Search...' });
    const list = await openPill(user);

    await user.type(screen.getByPlaceholderText('Search...'), 'ates');
    expect(list.getByText('Ates')).toBeInTheDocument();
    expect(list.queryByText('Insolvenz GmbH')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Client/ })); // close
    await user.click(screen.getByRole('button', { name: /Client/ })); // reopen
    expect(await screen.findByPlaceholderText('Search...')).toHaveValue('');
  });

  describe('i18n', () => {
    it('has no built-in English text: the search placeholder is whatever the caller passes', async () => {
      const user = userEvent.setup();
      renderPill({ searchPlaceholder: 'Suchen...' });
      await openPill(user);
      expect(screen.getByPlaceholderText('Suchen...')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
    });

    it('names the search box after the pill when no placeholder is given, instead of English text', async () => {
      const user = userEvent.setup();
      renderPill();
      await openPill(user);
      const input = screen.getAllByRole('textbox')[0];
      expect(input).toHaveAttribute('aria-label', 'Client');
      expect(input).not.toHaveAttribute('placeholder', 'Search...');
    });

    it('shows the caller-supplied text when there is nothing to list', async () => {
      const user = userEvent.setup();
      renderPill({ options: [], emptyText: 'Keine Optionen' });
      await user.click(screen.getByRole('button', { name: /Client/ }));
      expect(await screen.findByText('Keine Optionen')).toBeInTheDocument();
    });
  });

  it('shows a spinner instead of the list while options load', async () => {
    const user = userEvent.setup();
    renderPill({ loading: true });
    await user.click(screen.getByRole('button', { name: /Client/ }));
    await screen.findByRole('textbox');
    expect(screen.queryByText('Ates')).not.toBeInTheDocument();
  });

  it('omits the search box when searchable is off', async () => {
    const user = userEvent.setup();
    renderPill({ searchable: false });
    await user.click(screen.getByRole('button', { name: /Client/ }));
    await screen.findByText('Ates');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
