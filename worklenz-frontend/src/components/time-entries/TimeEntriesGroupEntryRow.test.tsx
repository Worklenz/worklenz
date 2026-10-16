import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IGroupedTimeEntry } from '@/api/tasks/task-time-logs.api.service';
import { TimeEntriesGroupEntryRow } from './TimeEntriesGroupEntryRow';

// Ant Design is real; only app-level collaborators are mocked.
const mocks = vi.hoisted(() => ({
  session: { id: 'u-me' },
  isOwnerOrAdmin: false,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({
    getCurrentSession: () => mocks.session,
    isOwnerOrAdmin: () => mocks.isOwnerOrAdmin,
  }),
}));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ themeReducer: { mode: 'light' } }),
}));
vi.mock('@/components/task-drawer/shared/time-log/time-log-form', () => ({
  default: (props: { asTimeEntry?: boolean; initialValues?: { id?: string }; onCancel: () => void }) => (
    <div
      data-testid="time-log-form"
      data-as-time-entry={String(!!props.asTimeEntry)}
      data-log-id={props.initialValues?.id}
    >
      <button type="button" onClick={props.onCancel}>
        stub-cancel
      </button>
    </div>
  ),
}));

const makeEntry = (overrides: Partial<IGroupedTimeEntry>): IGroupedTimeEntry => ({
  id: 'log-1',
  task_id: 'task-1',
  task_name: 'Task A',
  project_id: 'project-1',
  project_name: 'Project One',
  time_spent: 1800,
  created_at: '2026-09-24T04:26:00.000Z',
  user_id: 'u-me',
  user_name: 'Me',
  ...overrides,
});

const onDelete = vi.fn();
const onUpdate = vi.fn();

const renderRow = (entry: IGroupedTimeEntry) =>
  render(
    <TimeEntriesGroupEntryRow
      entry={entry}
      groupBy="project"
      scope="all"
      onDelete={onDelete}
      onUpdate={onUpdate}
    />
  );

/** The row's actions only appear on hover (visibility), so hover first. */
const hoverRow = async (user: ReturnType<typeof userEvent.setup>) => {
  const row = screen.getByText('Task A').closest('div[class*="ant-flex"]');
  if (!row) throw new Error('row not found');
  await user.hover(row);
};

describe('TimeEntriesGroupEntryRow - edit/delete permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { id: 'u-me' };
    mocks.isOwnerOrAdmin = false;
  });

  it('shows Edit and Delete on an entry the viewer logged', async () => {
    const user = userEvent.setup();
    renderRow(makeEntry({ user_id: 'u-me' }));
    await hoverRow(user);

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('hides the actions on someone else\'s entry for a member (e.g. a team lead viewing others)', async () => {
    const user = userEvent.setup();
    renderRow(makeEntry({ user_id: 'u-other', user_name: 'Someone Else' }));
    await hoverRow(user);

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('shows the actions on someone else\'s entry for an owner/admin', async () => {
    const user = userEvent.setup();
    mocks.isOwnerOrAdmin = true;
    renderRow(makeEntry({ user_id: 'u-other', user_name: 'Someone Else' }));
    await hoverRow(user);

    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('opens the edit dialog saving through the Time Entries endpoint, and closes it on cancel', async () => {
    const user = userEvent.setup();
    mocks.isOwnerOrAdmin = true;
    renderRow(makeEntry({ id: 'log-9', user_id: 'u-other' }));
    await hoverRow(user);

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit time entry' });
    const form = within(dialog).getByTestId('time-log-form');
    expect(form).toHaveAttribute('data-as-time-entry', 'true');
    expect(form).toHaveAttribute('data-log-id', 'log-9');

    await user.click(within(form).getByRole('button', { name: 'stub-cancel' }));
    await waitFor(() => expect(screen.queryByTestId('time-log-form')).not.toBeInTheDocument());
  });

  it('confirms before deleting, then hands the entry to onDelete', async () => {
    const user = userEvent.setup();
    renderRow(makeEntry({ id: 'log-1', task_id: 'task-1', user_id: 'u-me' }));
    await hoverRow(user);

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    const popconfirm = await waitFor(() => {
      const el = document.querySelector<HTMLElement>('.ant-popconfirm');
      if (!el) throw new Error('confirmation not shown yet');
      return el;
    });
    await user.click(within(popconfirm).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('log-1', 'task-1'));
  });
});
