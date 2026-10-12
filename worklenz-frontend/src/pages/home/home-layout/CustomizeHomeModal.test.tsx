import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import homePreferencesReducer from '@/features/home-page/homePreferences.slice';
import homePageReducer, { setHomeTasksConfig } from '@/features/home-page/home-page.slice';
import navPreferencesReducer from '@/features/navigation/navPreferences.slice';
import CustomizeHomeModal from './CustomizeHomeModal';

// The real hook needs auth, a responsive hook and project selectors; the dialog only needs the
// sidebar items this user can see.
vi.mock('@/features/navigation/useNavPreferences', () => {
  const items = [
    { key: 'overview', label: 'Overview', icon: null },
    { key: 'my-tasks', label: 'My Tasks', icon: null },
    { key: 'calendar', label: 'Calendar', icon: null },
  ];
  const groups = [{ key: '', items }];
  const result = {
    surface: { key: 'home', defaultItemKey: 'overview', groups },
    resolved: { groups, activeDefaultKey: 'overview', collapsed: false },
    allItems: items,
    hiddenKeys: [],
    isPinned: () => false,
  };
  return { useNavPreferences: () => result };
});

// No i18n instance in tests: resolve each key to its `defaultValue`, interpolating {{vars}}.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, string> = {}) =>
      (options.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => options[name] ?? ''),
  }),
}));

const renderModal = (onClose = () => {}) => {
  const store = configureStore({
    reducer: { homePreferencesReducer, homePageReducer, navPreferencesReducer },
  });
  render(
    <Provider store={store}>
      <CustomizeHomeModal open onClose={onClose} />
    </Provider>
  );
  const saved = () => store.getState().homePreferencesReducer;
  const nav = () => store.getState().navPreferencesReducer;
  return { store, saved, nav };
};

const openTab = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getByRole('tab', { name }));

describe('CustomizeHomeModal – layout', () => {
  it('lists the greeting banner and every section with its on/off switch', () => {
    renderModal();
    expect(screen.getByRole('switch', { name: 'Show Greeting banner' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Show Summary cards' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Show Task priorities' })).toBeChecked();
  });

  it('keeps Save disabled until something changes', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('hides the greeting banner on Save, leaving the saved layout alone until then', async () => {
    const user = userEvent.setup();
    const { saved } = renderModal();

    await user.click(screen.getByRole('switch', { name: 'Show Greeting banner' }));
    expect(saved().layout.hidden).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved().layout.hidden).toEqual(['greeting']);
  });

  it('gives the greeting banner no move controls', () => {
    renderModal();
    expect(screen.queryByRole('button', { name: /Move Greeting banner/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Reorder Greeting banner/ })).toBeNull();
  });

  it('reorders a section with the move buttons', async () => {
    const user = userEvent.setup();
    const { saved } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Move My progress down' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved().layout.columns.side).toEqual(['todo', 'progress-donut']);
  });

  it('moves a section to the main area', async () => {
    const user = userEvent.setup();
    const { saved } = renderModal();

    await user.click(
      screen.getByRole('button', { name: /Move to main area: My todo list/ })
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved().layout.columns.main[0]).toBe('todo');
    expect(saved().layout.columns.side).toEqual(['progress-donut']);
  });

  it('discards changes on Cancel', async () => {
    const user = userEvent.setup();
    let closed = false;
    const { saved } = renderModal(() => {
      closed = true;
    });

    await user.click(screen.getByRole('switch', { name: 'Show My progress' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(closed).toBe(true);
    expect(saved().layout.hidden).toEqual([]);
  });
});

describe('CustomizeHomeModal – task tabs', () => {
  it('reorders and hides tabs, saved together with the rest', async () => {
    const user = userEvent.setup();
    const { saved } = renderModal();

    await openTab(user, 'Task tabs');
    await user.click(screen.getByRole('button', { name: 'Move Overdue up' }));
    await user.click(screen.getByRole('switch', { name: 'Show Upcoming' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(saved().tabs.order).toEqual(['All', 'Overdue', 'Today', 'Upcoming', 'NoDueDate', 'Pinned']);
    expect(saved().tabs.hidden).toEqual(['Upcoming']);
  });

  it('locks the last visible tab on', async () => {
    const user = userEvent.setup();
    renderModal();

    await openTab(user, 'Task tabs');
    for (const name of ['Recent', 'Today', 'Overdue', 'Upcoming', 'No Due Date']) {
      await user.click(screen.getByRole('switch', { name: `Show ${name}` }));
    }
    expect(screen.getByRole('switch', { name: 'Show Pinned' })).toBeDisabled();
  });
});

describe('CustomizeHomeModal – sorting', () => {
  it('saves a sort field and direction', async () => {
    const user = userEvent.setup();
    const { saved } = renderModal();

    await openTab(user, 'Sorting');
    expect(screen.getByRole('radio', { name: /Default order/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Ascending' })).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: 'Priority' }));
    await user.click(screen.getByRole('radio', { name: 'Descending' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(saved().selections.sort).toEqual({ field: 'priority', order: 'desc' });
  });

  it('goes back to the default order', async () => {
    const user = userEvent.setup();
    const { saved } = renderModal();

    await openTab(user, 'Sorting');
    await user.click(screen.getByRole('radio', { name: 'Status' }));
    await user.click(screen.getByRole('radio', { name: /Default order/ }));
    // Back to what is saved, so there is nothing left to save.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(saved().selections.sort).toBeNull();
  });
});

describe('CustomizeHomeModal – live preview and rollback', () => {
  it('shows a change on the page straight away without saving it', async () => {
    const user = userEvent.setup();
    const { saved } = renderModal();

    await user.click(screen.getByRole('switch', { name: 'Show My progress' }));
    expect(saved().preview?.layout.hidden).toEqual(['progress-donut']);
    expect(saved().layout.hidden).toEqual([]);
  });

  it('rolls the preview back when closed without saving', async () => {
    const user = userEvent.setup();
    const { saved, nav } = renderModal();

    await user.click(screen.getByRole('switch', { name: 'Show My progress' }));
    await openTab(user, 'Left sidebar');
    await user.click(screen.getByRole('button', { name: 'Move Calendar up' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(saved().preview).toBeNull();
    expect(nav().preview).toBeNull();
    expect(saved().layout.hidden).toEqual([]);
    expect(nav().order).toEqual({});
  });

  it('puts the task table back on the tab it was on when the preview moved it', async () => {
    const user = userEvent.setup();
    const { store } = renderModal();
    const config = () => store.getState().homePageReducer.homeTasksConfig;
    const before = config().current_tab;

    // What the page does when the previewed tab list no longer includes the active tab.
    store.dispatch(setHomeTasksConfig({ ...config(), current_tab: 'Pinned' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(config().current_tab).toBe(before);
  });

  it('keeps the changes and drops the preview on Save', async () => {
    const user = userEvent.setup();
    const { saved } = renderModal();

    await user.click(screen.getByRole('switch', { name: 'Show My progress' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(saved().preview).toBeNull();
    expect(saved().layout.hidden).toEqual(['progress-donut']);
  });
});

describe('CustomizeHomeModal – default assigned group', () => {
  it('starts on "Whichever I used last"', async () => {
    const user = userEvent.setup();
    renderModal();

    await openTab(user, 'Task tabs');
    expect(screen.getByRole('radio', { name: 'Whichever I used last' })).toBeChecked();
  });

  it('previews the chosen group on the table, then saves it as the default', async () => {
    const user = userEvent.setup();
    const { store, saved } = renderModal();
    const group = () => store.getState().homePageReducer.homeTasksConfig.tasks_group_by;
    expect(group()).toBe(0);

    await openTab(user, 'Task tabs');
    await user.click(screen.getByRole('radio', { name: 'Assigned by me' }));
    expect(saved().preview?.assignedDefault).toBe(1);
    expect(group()).toBe(1);
    expect(saved().selections.pinnedAssignedGroup).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(saved().selections.pinnedAssignedGroup).toBe(1);
    expect(group()).toBe(1);
  });

  it('puts the table back on its group when closed without saving', async () => {
    const user = userEvent.setup();
    const { store, saved } = renderModal();
    const group = () => store.getState().homePageReducer.homeTasksConfig.tasks_group_by;

    await openTab(user, 'Task tabs');
    await user.click(screen.getByRole('radio', { name: 'Assigned by me' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(group()).toBe(0);
    expect(saved().selections.pinnedAssignedGroup).toBeNull();
  });

  it('clears the default again with "Whichever I used last"', async () => {
    const user = userEvent.setup();
    const { saved } = renderModal();

    await openTab(user, 'Task tabs');
    await user.click(screen.getByRole('radio', { name: 'Assigned to me' }));
    await user.click(screen.getByRole('radio', { name: 'Whichever I used last' }));
    // Back to what is saved, so there is nothing left to save.
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(saved().preview?.assignedDefault).toBeNull();
  });
});

describe('CustomizeHomeModal – left sidebar', () => {
  it('lists every sidebar item with a show/hide switch, locking the page Home opens on', async () => {
    const user = userEvent.setup();
    renderModal();

    await openTab(user, 'Left sidebar');
    expect(screen.getByRole('button', { name: 'Move My Tasks up' })).toBeEnabled();
    expect(screen.getByRole('switch', { name: 'Show My Tasks' })).toBeChecked();
    // Overview is the default landing page.
    expect(screen.getByRole('switch', { name: 'Show Overview' })).toBeDisabled();
  });

  it('previews hiding an item, then saves it', async () => {
    const user = userEvent.setup();
    const { nav } = renderModal();

    await openTab(user, 'Left sidebar');
    await user.click(screen.getByRole('switch', { name: 'Show Calendar' }));
    expect(nav().preview?.hiddenItems).toEqual(['calendar']);
    expect(nav().hidden).toEqual({});

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(nav().hidden?.home).toEqual(['calendar']);
    expect(nav().preview).toBeNull();
  });

  it('shows the item the user pins even if it was hidden, and frees the old landing page', async () => {
    const user = userEvent.setup();
    const { nav } = renderModal();

    await openTab(user, 'Left sidebar');
    await user.click(screen.getByRole('switch', { name: 'Show Calendar' }));
    await user.click(screen.getByRole('button', { name: 'Pin Calendar as the page that opens first' }));
    expect(nav().preview?.hiddenItems).toEqual([]);
    expect(screen.getByRole('switch', { name: 'Show Calendar' })).toBeChecked();
    // Overview is no longer where Home opens, so it can be hidden now.
    expect(screen.getByRole('switch', { name: 'Show Overview' })).toBeEnabled();
  });

  it('rolls a hidden item back when closed without saving', async () => {
    const user = userEvent.setup();
    const { nav } = renderModal();

    await openTab(user, 'Left sidebar');
    await user.click(screen.getByRole('switch', { name: 'Show Calendar' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(nav().preview).toBeNull();
    expect(nav().hidden).toEqual({});
  });

  it('previews a reorder and a pin, then saves them', async () => {
    const user = userEvent.setup();
    const { nav } = renderModal();

    await openTab(user, 'Left sidebar');
    await user.click(screen.getByRole('button', { name: 'Move Calendar up' }));
    await user.click(screen.getByRole('button', { name: 'Pin Calendar as the page that opens first' }));

    expect(nav().preview).toEqual({
      surfaceKey: 'home',
      groupOrder: { '': ['overview', 'calendar', 'my-tasks'] },
      pinnedDefault: 'calendar',
      hiddenItems: [],
    });
    expect(nav().order).toEqual({});

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(nav().preview).toBeNull();
    expect(nav().order.home).toEqual({ '': ['overview', 'calendar', 'my-tasks'] });
    expect(nav().pinnedDefaults.home).toBe('calendar');
  });

  it('pins one item at a time and unpins on a second click', async () => {
    const user = userEvent.setup();
    const { nav } = renderModal();

    await openTab(user, 'Left sidebar');
    await user.click(screen.getByRole('button', { name: 'Pin Calendar as the page that opens first' }));
    await user.click(screen.getByRole('button', { name: 'Pin My Tasks as the page that opens first' }));
    expect(nav().preview?.pinnedDefault).toBe('my-tasks');

    await user.click(screen.getByRole('button', { name: 'Unpin My Tasks' }));
    expect(nav().preview?.pinnedDefault).toBeNull();
  });

  it('leaves the saved sidebar order alone when only the layout changed', async () => {
    const user = userEvent.setup();
    const { nav } = renderModal();

    await user.click(screen.getByRole('switch', { name: 'Show My progress' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(nav().order).toEqual({});
  });
});
