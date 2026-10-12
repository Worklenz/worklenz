import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import homePreferencesReducer, { setHomeContinueTabs } from '@/features/home-page/homePreferences.slice';
import { HomeWidgetProvider } from '../home-widgets/HomeWidgetContext';
import { ContinueTabsMenu } from './ContinueTabsMenu';

// No i18n instance in tests: resolve each key to its `defaultValue`, interpolating {{vars}}.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, string> = {}) =>
      (options.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => options[name] ?? ''),
  }),
}));

const TITLE = 'Continue where you left off';

const renderMenu = () => {
  const store = configureStore({ reducer: { homePreferencesReducer } });
  render(
    <Provider store={store}>
      <HomeWidgetProvider
        value={{
          id: 'continue',
          title: TITLE,
          actions: { otherColumn: 'main', canRemove: true, onMoveToOtherColumn: () => {}, onRemove: () => {} },
        }}
      >
        <ContinueTabsMenu />
      </HomeWidgetProvider>
    </Provider>
  );
  const hidden = () => store.getState().homePreferencesReducer.continueTabs.hidden;
  const open = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: `${TITLE} options` }));
  return { store, hidden, open };
};

const toggle = (name: string) => screen.getByRole('menuitemcheckbox', { name });

describe('ContinueTabsMenu', () => {
  it('lists the four toggles, all shown to begin with, above the usual widget actions', async () => {
    const user = userEvent.setup();
    const { open } = renderMenu();
    await open(user);

    expect(screen.getByText('Show tabs')).toBeInTheDocument();
    for (const name of ['Projects', 'Tasks', 'Activity', 'Time Logged']) {
      expect(toggle(name)).toHaveAttribute('aria-checked', 'true');
    }
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual(['Move to main area', 'Remove widget']);
  });

  it('hides a toggle and shows it again', async () => {
    const user = userEvent.setup();
    const { hidden, open } = renderMenu();
    await open(user);

    await user.click(toggle('Activity'));
    expect(hidden()).toEqual(['activity']);
    expect(toggle('Activity')).toHaveAttribute('aria-checked', 'false');

    await user.click(toggle('Activity'));
    expect(hidden()).toEqual([]);
    expect(toggle('Activity')).toHaveAttribute('aria-checked', 'true');
  });

  it('stays open while several toggles are switched', async () => {
    const user = userEvent.setup();
    const { hidden, open } = renderMenu();
    await open(user);

    await user.click(toggle('Projects'));
    await user.click(toggle('Time Logged'));
    expect(hidden()).toEqual(['projects', 'time']);
    expect(toggle('Tasks')).toBeVisible();
  });

  it('keeps the last toggle on', async () => {
    const user = userEvent.setup();
    const { store, hidden, open } = renderMenu();
    store.dispatch(setHomeContinueTabs({ hidden: ['projects', 'activity', 'time'] }));
    await open(user);

    expect(toggle('Tasks')).toHaveAttribute('aria-disabled', 'true');
    await user.click(toggle('Tasks'));
    expect(hidden()).toEqual(['projects', 'activity', 'time']);
    // The others can still be brought back.
    await user.click(toggle('Projects'));
    expect(hidden()).toEqual(['activity', 'time']);
  });

  it('still closes for the actions that are not toggles', async () => {
    const user = userEvent.setup();
    const { open } = renderMenu();
    await open(user);

    await user.click(screen.getByRole('menuitem', { name: /Move to main area/ }));
    // A closed menu stays in the page, hidden, so it is gone from the accessibility tree rather than the DOM.
    await waitFor(() => expect(screen.queryByRole('menuitemcheckbox', { name: 'Projects' })).toBeNull());
  });
});
