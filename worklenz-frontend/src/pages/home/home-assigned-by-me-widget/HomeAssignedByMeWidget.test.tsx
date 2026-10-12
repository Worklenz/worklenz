import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import themeReducer from '@/features/theme/themeSlice';
import { HomeWidgetProvider } from '../home-widgets/HomeWidgetContext';
import { HomeAssignedByMeWidget } from './HomeAssignedByMeWidget';
import type { HomeColumn } from '../home-layout/homeLayout';

// No i18n instance in tests: resolve each key to its `defaultValue`, interpolating {{vars}}.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: Record<string, string> = {}) =>
      (options.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(options[name] ?? '')),
  }),
}));

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

const openTask = vi.hoisted(() => vi.fn());
vi.mock('../home-widgets/useOpenHomeTask', () => ({ useOpenHomeTask: () => openTask }));

const query = vi.hoisted(() => ({ tasks: [] as unknown[], total: 0, lastArg: undefined as unknown }));
vi.mock('@/api/home-page/home-page.api.service', () => ({
  useGetMyTasksQuery: (arg: unknown) => {
    query.lastArg = arg;
    return { data: { body: { tasks: query.tasks, total: query.total } }, isLoading: false, isError: false, refetch: vi.fn() };
  },
  useGetTaskFilterOptionsQuery: () => ({
    data: {
      body: {
        projects: [{ project_id: 'p1', project_name: 'Website' }],
        statuses: [],
        assignees: [{ team_member_id: 'm1', name: 'Alice Smith' }],
      },
    },
  }),
}));

// The real picker edits the due date over a socket; here it only has to show it.
vi.mock('@/components/home-tasks/taskDatePicker/home-tasks-date-picker', () => ({
  default: ({ record }: { record: { end_date?: string | null } }) => <span>{record.end_date ? 'Jan 5' : 'Set Due Date'}</span>,
}));

// The real modal needs sockets and the team; the widget only has to open it.
vi.mock('../task-list/HomeAddTaskModal', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div role="dialog">New Task</div> : null),
}));

const makeTask = (i: number, over: Record<string, unknown> = {}) => ({
  id: `t${i}`,
  name: `Task ${i}`,
  project_id: 'p1',
  project_name: 'Website',
  project_color: '#1677ff',
  end_date: '2030-01-05',
  assignees: [{ team_member_id: `m${i}`, name: 'Alice Smith' }],
  ...over,
});

const renderWidget = (column: HomeColumn | null) => {
  const store = configureStore({ reducer: { themeReducer } });
  render(
    <Provider store={store}>
      <HomeWidgetProvider
        value={{
          id: 'assigned-by-me',
          title: 'Tasks assigned by me',
          column,
          actions: { otherColumn: 'side', canRemove: true, onMoveToOtherColumn: () => {}, onRemove: () => {} },
        }}
      >
        <HomeAssignedByMeWidget />
      </HomeWidgetProvider>
    </Provider>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  query.tasks = [makeTask(1), makeTask(2, { assignees: [], end_date: null })];
  query.total = 2;
});

describe('HomeAssignedByMeWidget', () => {
  it('asks for up to 50 tasks in one go, assigned by the user', () => {
    renderWidget('main');
    expect(query.lastArg).toMatchObject({ tasks_group_by: 1, index: 1, size: 50 });
  });

  it('in the main area, is a table with task, assignee, project and due date on one row', () => {
    renderWidget('main');
    expect(screen.getAllByRole('columnheader').map(h => h.textContent)).toEqual([
      'Task Name',
      'Assignee',
      'Project',
      'Due Date',
    ]);

    const first = screen.getByText('Task 1').closest('tr') as HTMLElement;
    expect(within(first).getByText('Alice Smith')).toBeInTheDocument();
    expect(within(first).getByText('Website')).toBeInTheDocument();
    expect(within(first).getByText('Jan 5')).toBeInTheDocument();

    // No assignee still leaves its cell, so the columns stay lined up.
    const second = screen.getByText('Task 2').closest('tr') as HTMLElement;
    expect(within(second).getAllByRole('cell')).toHaveLength(4);
    expect(within(second).getByText('—')).toBeInTheDocument();
  });

  it('never scrolls sideways: the table area clips instead of scrolling horizontally', () => {
    renderWidget('main');
    const scroller = screen.getByRole('table').closest('[data-widget-data]') as HTMLElement;
    expect(scroller.style.overflowX).toBe('hidden');
  });

  it('has the project filter of the priorities table, and an assignee one', async () => {
    const user = userEvent.setup();
    renderWidget('main');
    expect(document.querySelectorAll('.ant-table-filter-trigger')).toHaveLength(2);

    await user.click(within(screen.getByRole('columnheader', { name: /Project/ })).getByRole('button'));
    await user.click(await screen.findByText('Website', { selector: '.ant-dropdown-menu-title-content span, .ant-dropdown-menu-title-content, span' }));
    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(query.lastArg).toMatchObject({ projectIds: ['p1'], tasks_group_by: 1, size: 50 });
  });

  it('sorts from the headings, and a cleared sort goes back to soonest due first', async () => {
    const user = userEvent.setup();
    renderWidget('main');
    expect(query.lastArg).toMatchObject({ sortField: 'end_date', sortOrder: 'asc' });

    const heading = () => screen.getByRole('columnheader', { name: /Project/ });
    await user.click(heading());
    expect(query.lastArg).toMatchObject({ sortField: 'project_name', sortOrder: 'asc' });
    await user.click(heading());
    expect(query.lastArg).toMatchObject({ sortField: 'project_name', sortOrder: 'desc' });
    await user.click(heading());
    expect(query.lastArg).toMatchObject({ sortField: 'end_date', sortOrder: 'asc' });
  });

  it.each([['side' as const], [null]])('in %s keeps the compact two-line list, with no table, filters or sorting', column => {
    renderWidget(column);
    expect(screen.queryByRole('table')).toBeNull();
    expect(query.lastArg).toMatchObject({ sortField: 'end_date', sortOrder: 'asc' });
    expect(query.lastArg).not.toHaveProperty('projectIds');
    const first = screen.getByText('Task 1').closest('button') as HTMLElement;
    expect(within(first).getByText('Website')).toBeInTheDocument();
    expect(within(first).getByText('Jan 5')).toBeInTheDocument();
  });

  it('opens the task when its row is clicked', async () => {
    const user = userEvent.setup();
    renderWidget('main');
    await user.click(screen.getByText('Task 1'));
    expect(openTask).toHaveBeenCalledWith('t1', 'p1');
  });

  it('has an Assign new task entry in its menu that opens the task form', async () => {
    const user = userEvent.setup();
    renderWidget('main');
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Tasks assigned by me options' }));
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      'Assign new task',
      'Move to side panel',
      'Remove widget',
    ]);
    await user.click(screen.getByRole('menuitem', { name: 'Assign new task' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('New Task');
  });

  it('offers Assign new task from the empty state too', async () => {
    const user = userEvent.setup();
    query.tasks = [];
    query.total = 0;
    renderWidget('main');
    await user.click(screen.getByRole('button', { name: 'Assign new task' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('goes to My Tasks, on Assigned by me, from View all', async () => {
    const user = userEvent.setup();
    query.total = 31;
    renderWidget('main');
    await user.click(screen.getByRole('button', { name: 'View all assigned tasks (31)' }));
    expect(navigate).toHaveBeenCalledWith('/worklenz/home/my-tasks?filter=assigned-by-me');
  });
});
