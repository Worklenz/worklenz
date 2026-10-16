import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IRecentTimeLog } from '@/api/tasks/task-time-logs.api.service';
import { TimeEntriesLogTable } from './TimeEntriesLogTable';

// Only app-level collaborators are mocked; Ant Design's Table and Modal are real, so the hover
// actions and the edit dialog are exercised for real.
const mocks = vi.hoisted(() => ({
  session: { id: 'u-me' },
  isOwnerOrAdmin: false,
  deleteEntry: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown> & { defaultValue?: string }) =>
      (options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String(options?.[name] ?? '')
      ),
  }),
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({
    getCurrentSession: () => mocks.session,
    isOwnerOrAdmin: () => mocks.isOwnerOrAdmin,
  }),
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ themeReducer: { mode: 'light' }, priorityReducer: { priorities: [] } }),
}));
vi.mock('@/features/taskAttributes/taskPrioritySlice', () => ({
  fetchPriorities: () => ({ type: 'test/fetchPriorities' }),
}));
vi.mock('@/features/task-drawer/task-drawer.slice', () => ({
  setSelectedTaskId: vi.fn(),
  setShowTaskDrawer: vi.fn(),
  fetchTask: vi.fn(),
  setNavigationContext: vi.fn(),
}));
vi.mock('@/features/project/project.slice', () => ({ setProjectId: vi.fn() }));
vi.mock('@/features/projects/singleProject/phase/phases.slice', () => ({
  fetchPhasesByProjectId: vi.fn(),
}));
vi.mock('@/features/task-management/task-management.slice', () => ({ updateTask: vi.fn() }));
vi.mock('@/api/tasks/task-time-logs.api.service', () => ({
  taskTimeLogsApiService: { deleteEntry: (...args: unknown[]) => mocks.deleteEntry(...args) },
}));
vi.mock('@/components/task-drawer/shared/time-log/time-log-form', () => ({
  default: (props: {
    asTimeEntry?: boolean;
    inModal?: boolean;
    taskId?: string;
    projectId?: string;
    initialValues?: { id?: string; time_spent?: number };
    onCancel: () => void;
    onSubmitSuccess?: () => void;
  }) => (
    <div
      data-testid="time-log-form"
      data-as-time-entry={String(!!props.asTimeEntry)}
      data-in-modal={String(!!props.inModal)}
      data-log-id={props.initialValues?.id}
      data-task-id={props.taskId}
      data-project-id={props.projectId}
      data-time-spent={String(props.initialValues?.time_spent)}
    >
      <button type="button" onClick={props.onSubmitSuccess}>
        stub-save
      </button>
      <button type="button" onClick={props.onCancel}>
        stub-cancel
      </button>
    </div>
  ),
}));

const makeLog = (overrides: Partial<IRecentTimeLog>): IRecentTimeLog => ({
  id: 'log-1',
  task_id: 'task-1',
  task_name: 'Task A',
  project_id: 'project-1',
  project_name: 'Project One',
  created_at: '2026-09-24T04:26:00.000Z',
  user_id: 'u-me',
  user_name: 'Me',
  // Postgres NUMERIC arrives as a string at runtime, whatever the type says.
  time_spent: '1800' as unknown as number,
  billable: true,
  ...overrides,
});

const OWN_ENTRY = makeLog({ id: 'log-1', task_id: 'task-1', task_name: 'Task A', user_id: 'u-me' });
const OTHERS_ENTRY = makeLog({
  id: 'log-2',
  task_id: 'task-2',
  task_name: 'Task B',
  project_id: 'project-2',
  user_id: 'u-other',
  user_name: 'Someone Else',
});

const onEntryChange = vi.fn();

const renderTable = (overrides: Partial<React.ComponentProps<typeof TimeEntriesLogTable>> = {}) =>
  render(
    <TimeEntriesLogTable
      logs={[OWN_ENTRY, OTHERS_ENTRY]}
      loading={false}
      total={2}
      page={1}
      pageSize={20}
      onPageChange={vi.fn()}
      sortField={null}
      sortOrder="desc"
      onSortChange={vi.fn()}
      onLogTime={vi.fn()}
      showAuthor={false}
      projectOptions={[]}
      selectedProjectIds={[]}
      onProjectFilterChange={vi.fn()}
      statusOptions={[]}
      selectedStatusNames={[]}
      onStatusFilterChange={vi.fn()}
      selectedPriorityIds={[]}
      onPriorityFilterChange={vi.fn()}
      selectedBillableValues={[]}
      onBillableFilterChange={vi.fn()}
      onEntryChange={onEntryChange}
      allowEntryActions
      {...overrides}
    />
  );

const rowOf = (taskName: string): HTMLElement => {
  const row = screen.getByText(taskName).closest('tr');
  if (!row) throw new Error(`No table row found for "${taskName}"`);
  return row;
};

describe('TimeEntriesLogTable - hover edit/delete actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { id: 'u-me' };
    mocks.isOwnerOrAdmin = false;
    mocks.deleteEntry.mockResolvedValue({ done: true });
  });

  describe('who gets the actions (Flat view)', () => {
    it('lets a member change only the entries they logged themselves', () => {
      renderTable();

      expect(within(rowOf('Task A')).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
      expect(within(rowOf('Task A')).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      expect(within(rowOf('Task B')).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
      expect(within(rowOf('Task B')).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('lets an owner/admin change every member\'s entries', () => {
      mocks.isOwnerOrAdmin = true;
      renderTable();

      expect(within(rowOf('Task A')).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
      expect(within(rowOf('Task B')).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
      expect(within(rowOf('Task B')).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('shows nothing when the viewer has no entries of their own and is not an admin', () => {
      mocks.session = { id: 'u-nobody' };
      renderTable();

      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });
  });

  describe('By task view', () => {
    it('has no per-entry actions, not even for an admin, and no Actions column', () => {
      mocks.isOwnerOrAdmin = true;
      renderTable({ allowEntryActions: false });

      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
      expect(screen.queryByText('Actions')).not.toBeInTheDocument();
    });
  });

  describe('editing', () => {
    it('opens the edit dialog for that entry, saving through the Time Entries endpoint', async () => {
      const user = userEvent.setup();
      renderTable();

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await user.click(within(rowOf('Task A')).getByRole('button', { name: 'Edit' }));

      const dialog = await screen.findByRole('dialog', { name: 'Edit time entry' });
      const form = within(dialog).getByTestId('time-log-form');
      expect(form).toHaveAttribute('data-as-time-entry', 'true');
      expect(form).toHaveAttribute('data-in-modal', 'true');
      expect(form).toHaveAttribute('data-log-id', 'log-1');
      expect(form).toHaveAttribute('data-task-id', 'task-1');
      expect(form).toHaveAttribute('data-project-id', 'project-1');
      // NUMERIC arrives as a string; the form must be handed a real number of seconds.
      expect(form).toHaveAttribute('data-time-spent', '1800');
    });

    it('does not expand the row - the form lives in the dialog, not under the row', async () => {
      const user = userEvent.setup();
      renderTable();

      await user.click(within(rowOf('Task A')).getByRole('button', { name: 'Edit' }));
      const dialog = await screen.findByRole('dialog');

      expect(document.querySelector('.ant-table-expanded-row')).toBeNull();
      expect(document.querySelector('.ant-table')?.contains(dialog)).toBe(false);
    });

    it('lets an admin open the editor on a member\'s entry and says whose entry it is', async () => {
      const user = userEvent.setup();
      mocks.isOwnerOrAdmin = true;
      renderTable();

      await user.click(within(rowOf('Task B')).getByRole('button', { name: 'Edit' }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByTestId('time-log-form')).toHaveAttribute('data-log-id', 'log-2');
      expect(within(dialog).getByText('Task B')).toBeInTheDocument();
      expect(within(dialog).getByText('Project One')).toBeInTheDocument();
      expect(within(dialog).getByText('Logged by Someone Else')).toBeInTheDocument();
    });

    it('does not label your own entry with a "Logged by" line', async () => {
      const user = userEvent.setup();
      renderTable();

      await user.click(within(rowOf('Task A')).getByRole('button', { name: 'Edit' }));

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).queryByText(/Logged by/)).not.toBeInTheDocument();
    });

    it('closes the dialog and refetches after a successful save', async () => {
      const user = userEvent.setup();
      renderTable();

      await user.click(within(rowOf('Task A')).getByRole('button', { name: 'Edit' }));
      await user.click(await screen.findByRole('button', { name: 'stub-save' }));

      await waitFor(() => expect(screen.queryByTestId('time-log-form')).not.toBeInTheDocument());
      expect(onEntryChange).toHaveBeenCalledTimes(1);
      expect(onEntryChange).toHaveBeenCalledWith();
    });

    it('closes the dialog without refetching on cancel', async () => {
      const user = userEvent.setup();
      renderTable();

      await user.click(within(rowOf('Task A')).getByRole('button', { name: 'Edit' }));
      await user.click(await screen.findByRole('button', { name: 'stub-cancel' }));

      await waitFor(() => expect(screen.queryByTestId('time-log-form')).not.toBeInTheDocument());
      expect(onEntryChange).not.toHaveBeenCalled();
    });

    it('closes the dialog without refetching on Escape, and keeps it open on an outside click', async () => {
      const user = userEvent.setup();
      renderTable();

      await user.click(within(rowOf('Task A')).getByRole('button', { name: 'Edit' }));
      await screen.findByRole('dialog');

      // A stray click on the backdrop must not throw away typed edits.
      const mask = document.querySelector<HTMLElement>('.ant-modal-wrap');
      if (!mask) throw new Error('modal wrapper not found');
      await user.click(mask);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // jsdom doesn't move focus into the dialog, so send the key to it directly.
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape', keyCode: 27 });
      await waitFor(() => expect(screen.queryByTestId('time-log-form')).not.toBeInTheDocument());
      expect(onEntryChange).not.toHaveBeenCalled();
    });

    it('closes an open dialog when the view switches to By task', async () => {
      const user = userEvent.setup();
      const { rerender } = renderTable();

      await user.click(within(rowOf('Task A')).getByRole('button', { name: 'Edit' }));
      expect(await screen.findByTestId('time-log-form')).toBeInTheDocument();

      rerender(
        <TimeEntriesLogTable
          logs={[OWN_ENTRY, OTHERS_ENTRY]}
          loading={false}
          total={2}
          page={1}
          pageSize={20}
          onPageChange={vi.fn()}
          sortField={null}
          sortOrder="desc"
          onSortChange={vi.fn()}
          onLogTime={vi.fn()}
          showAuthor={false}
          projectOptions={[]}
          selectedProjectIds={[]}
          onProjectFilterChange={vi.fn()}
          statusOptions={[]}
          selectedStatusNames={[]}
          onStatusFilterChange={vi.fn()}
          selectedPriorityIds={[]}
          onPriorityFilterChange={vi.fn()}
          selectedBillableValues={[]}
          onBillableFilterChange={vi.fn()}
          onEntryChange={onEntryChange}
          allowEntryActions={false}
        />
      );

      expect(screen.queryByTestId('time-log-form')).not.toBeInTheDocument();
    });
  });

  describe('deleting', () => {
    const confirmDelete = async (user: ReturnType<typeof userEvent.setup>, taskName: string) => {
      await user.click(within(rowOf(taskName)).getByRole('button', { name: 'Delete' }));
      const popconfirm = await waitFor(() => {
        const el = document.querySelector<HTMLElement>('.ant-popconfirm');
        if (!el) throw new Error('confirmation not shown yet');
        return el;
      });
      expect(within(popconfirm).getByText('Delete this time entry?')).toBeInTheDocument();
      await user.click(within(popconfirm).getByRole('button', { name: 'Delete' }));
    };

    it('asks for confirmation, deletes through the Time Entries endpoint, then refetches', async () => {
      const user = userEvent.setup();
      renderTable();

      await confirmDelete(user, 'Task A');

      await waitFor(() => expect(mocks.deleteEntry).toHaveBeenCalledWith('log-1', 'task-1'));
      await waitFor(() => expect(onEntryChange).toHaveBeenCalledWith({ deleted: true }));
    });

    it('lets an admin delete a member\'s entry', async () => {
      const user = userEvent.setup();
      mocks.isOwnerOrAdmin = true;
      renderTable();

      await confirmDelete(user, 'Task B');

      await waitFor(() => expect(mocks.deleteEntry).toHaveBeenCalledWith('log-2', 'task-2'));
    });

    it('does not delete anything when the confirmation is cancelled', async () => {
      const user = userEvent.setup();
      renderTable();

      await user.click(within(rowOf('Task A')).getByRole('button', { name: 'Delete' }));
      const popconfirm = await waitFor(() => {
        const el = document.querySelector<HTMLElement>('.ant-popconfirm');
        if (!el) throw new Error('confirmation not shown yet');
        return el;
      });
      await user.click(within(popconfirm).getByRole('button', { name: 'Cancel' }));

      expect(mocks.deleteEntry).not.toHaveBeenCalled();
      expect(onEntryChange).not.toHaveBeenCalled();
    });

    it('does not refetch when the server refuses (the API client already toasts the reason)', async () => {
      const user = userEvent.setup();
      mocks.deleteEntry.mockRejectedValue(new Error('403'));
      renderTable();

      await confirmDelete(user, 'Task A');

      await waitFor(() => expect(mocks.deleteEntry).toHaveBeenCalledTimes(1));
      expect(onEntryChange).not.toHaveBeenCalled();
    });
  });
});
