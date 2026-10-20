import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import homePreferencesReducer, { setHomeLayout } from '@/features/home-page/homePreferences.slice';
import homePageReducer from '@/features/home-page/home-page.slice';
import { addWidget, DEFAULT_HOME_LAYOUT } from '../home-layout/homeLayout';
import { HomeWidgetProvider } from '../home-widgets/HomeWidgetContext';
import { TaskTableSettingsMenu, TaskTableSettingsModal, type TaskTableSettingsTab } from './TaskTableSettings';

// No i18n instance in tests: resolve each key to its `defaultValue`, interpolating {{vars}}.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, string> = {}) =>
      (options.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => options[name] ?? ''),
  }),
}));

const makeStore = () => configureStore({ reducer: { homePreferencesReducer, homePageReducer } });

const renderModal = (initialTab: TaskTableSettingsTab = 'tabs', onClose = () => {}) => {
  const store = makeStore();
  render(
    <Provider store={store}>
      <TaskTableSettingsModal open initialTab={initialTab} onClose={onClose} />
    </Provider>
  );
  const prefs = () => store.getState().homePreferencesReducer;
  const group = () => store.getState().homePageReducer.homeTasksConfig.tasks_group_by;
  return { store, prefs, group };
};

describe('TaskTableSettingsModal', () => {
  it.each([
    ['tabs', () => screen.getByRole('switch', { name: 'Show Recent' })],
    ['view', () => screen.getByRole('radio', { name: 'Whichever I used last' })],
    ['sorting', () => screen.getByRole('radio', { name: /Default order/ })],
  ] as const)('opens on the %s tab', (tab, content) => {
    renderModal(tab);
    expect(content()).toBeInTheDocument();
    expect(screen.getByRole('tab', { selected: true })).toBeInTheDocument();
  });

  it('has the three settings as tabs, and nothing about the page layout or the sidebar', () => {
    renderModal();
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['Task tabs', 'Default view', 'Sorting']);
  });

  it('saves a tab reorder and a hidden tab at once, with no Save to press', async () => {
    const user = userEvent.setup();
    const { prefs } = renderModal('tabs');

    await user.click(screen.getByRole('button', { name: 'Move Overdue up' }));
    expect(prefs().tabs.order).toEqual(['All', 'Overdue', 'Today', 'Upcoming', 'NoDueDate', 'Pinned']);

    await user.click(screen.getByRole('switch', { name: 'Show Upcoming' }));
    expect(prefs().tabs.hidden).toEqual(['Upcoming']);
  });

  it('keeps the last visible tab on', async () => {
    const user = userEvent.setup();
    renderModal('tabs');
    for (const name of ['Recent', 'Today', 'Overdue', 'Upcoming', 'No Due Date']) {
      await user.click(screen.getByRole('switch', { name: `Show ${name}` }));
    }
    expect(screen.getByRole('switch', { name: 'Show Pinned' })).toBeDisabled();
  });

  it('saves the default list and switches the table to it right away', async () => {
    const user = userEvent.setup();
    const { prefs, group } = renderModal('view');
    expect(group()).toBe(0);

    await user.click(screen.getByRole('radio', { name: 'Assigned by me' }));
    expect(prefs().selections.pinnedAssignedGroup).toBe(1);
    expect(group()).toBe(1);

    await user.click(screen.getByRole('radio', { name: 'Assigned to me' }));
    expect(prefs().selections.pinnedAssignedGroup).toBe(0);
    expect(group()).toBe(0);
  });

  it('clears the default with "Whichever I used last", leaving the table where it is', async () => {
    const user = userEvent.setup();
    const { prefs, group } = renderModal('view');

    await user.click(screen.getByRole('radio', { name: 'Assigned by me' }));
    await user.click(screen.getByRole('radio', { name: 'Whichever I used last' }));
    expect(prefs().selections.pinnedAssignedGroup).toBeNull();
    expect(group()).toBe(1);
  });

  it('saves a sort field and direction', async () => {
    const user = userEvent.setup();
    const { prefs } = renderModal('sorting');
    expect(screen.getByRole('radio', { name: 'Ascending' })).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: 'Priority' }));
    await user.click(screen.getByRole('radio', { name: 'Descending' }));
    expect(prefs().selections.sort).toEqual({ field: 'priority', order: 'desc' });

    await user.click(screen.getByRole('radio', { name: /Default order/ }));
    expect(prefs().selections.sort).toBeNull();
  });

  it('never leaves a preview behind: changes go straight to the saved settings', async () => {
    const user = userEvent.setup();
    const { prefs } = renderModal('sorting');
    await user.click(screen.getByRole('radio', { name: 'Status' }));
    expect(prefs().preview).toBeNull();
    expect(prefs().selections.sort).toEqual({ field: 'status', order: 'asc' });
  });

  it('resets only these three settings, never the page layout', async () => {
    const user = userEvent.setup();
    const { store, prefs } = renderModal('sorting');
    const layout = addWidget(DEFAULT_HOME_LAYOUT, 'todo');
    store.dispatch(setHomeLayout(layout));

    expect(screen.getByRole('button', { name: 'Reset to default' })).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Task Name' }));
    expect(prefs().selections.sort).toEqual({ field: 'name', order: 'asc' });

    // Asks first; the confirm button in the popover carries the same label.
    await user.click(screen.getByRole('button', { name: 'Reset to default' }));
    const confirm = await screen.findByText('Reset the task table to its default settings?');
    await user.click(within(confirm.closest('.ant-popover') as HTMLElement).getByRole('button', { name: 'Reset to default' }));

    expect(prefs().selections.sort).toBeNull();
    expect(prefs().tabs).toEqual({ order: ['All', 'Today', 'Overdue', 'Upcoming', 'NoDueDate', 'Pinned'], hidden: [] });
    expect(prefs().layout).toEqual(layout);
  });

  it('closes on Done', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal('tabs', onClose);
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('TaskTableSettingsMenu', () => {
  let lastStore = makeStore();

  const renderMenu = (onCreateTask: () => void = () => {}) => {
    const store = makeStore();
    lastStore = store;
    render(
      <Provider store={store}>
        <HomeWidgetProvider
          value={{
            id: 'priorities',
            title: 'Task priorities',
            actions: { otherColumn: null, canRemove: false, onMoveToOtherColumn: () => {}, onRemove: () => {} },
          }}
        >
          <TaskTableSettingsMenu onCreateTask={onCreateTask} />
        </HomeWidgetProvider>
      </Provider>
    );
  };
  const openMenu = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: 'Task priorities options' }));

  it('lists the period, Create Task and the three table settings above Remove widget', async () => {
    const user = userEvent.setup();
    renderMenu();
    await openMenu(user);

    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      'Today',
      'This Week',
      'Create Task',
      'Task tabs',
      'Default view',
      'Sorting',
      'Remove widget',
    ]);
  });

  it('shows This Week by default and switches the period from the menu', async () => {
    const user = userEvent.setup();
    renderMenu();
    expect(lastStore.getState().homePreferencesReducer.selections.period).toBe('week');
    await openMenu(user);

    await user.click(screen.getByRole('menuitem', { name: 'Today' }));
    expect(lastStore.getState().homePreferencesReducer.selections.period).toBe('today');
  });

  it('creates a task from the menu, without opening the settings dialog', async () => {
    const user = userEvent.setup();
    const onCreateTask = vi.fn();
    renderMenu(onCreateTask);
    await openMenu(user);

    await user.click(screen.getByRole('menuitem', { name: 'Create Task' }));
    expect(onCreateTask).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each([
    ['Task tabs', () => screen.getByRole('switch', { name: 'Show Recent' })],
    ['Default view', () => screen.getByRole('radio', { name: 'Whichever I used last' })],
    ['Sorting', () => screen.getByRole('radio', { name: /Default order/ })],
  ] as const)('opens the dialog on the right tab for "%s"', async (entry, content) => {
    const user = userEvent.setup();
    renderMenu();
    await openMenu(user);

    await user.click(screen.getByRole('menuitem', { name: entry }));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Customize task table');
    expect(content()).toBeInTheDocument();
  });
});
