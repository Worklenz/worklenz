import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimeLogForm from '@/components/task-drawer/shared/time-log/time-log-form';
import { EditTimeEntryModal, type EditableTimeEntry } from './EditTimeEntryModal';

// The REAL time-log form inside the REAL modal - only the store, socket and HTTP layer are stubbed.
// This is the path a user takes: open Edit, change nothing (or something), press Update.
const mocks = vi.hoisted(() => ({
  updateEntry: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown> & { defaultValue?: string }) =>
      (options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String(options?.[name] ?? '')
      ),
  }),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({
    getCurrentSession: () => ({ id: 'u-me', team_member_id: 'tm-me' }),
  }),
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      themeReducer: { mode: 'light' },
      taskDrawerReducer: { taskFormViewModel: null },
      orgConfigReducer: { timelog_backdate_limit_days: 0, isInitialized: true, isLoading: false },
    }),
}));
vi.mock('@/features/org-config/org-config.slice', () => ({
  fetchOrgConfig: () => ({ type: 'test/fetchOrgConfig' }),
}));
vi.mock('@/socket/socketContext', () => ({ useSocket: () => ({ socket: null, connected: false }) }));
vi.mock('@/api/api-client', () => ({ default: { get: vi.fn() } }));
vi.mock('@/api/tasks/task-time-logs.api.service', () => ({
  taskTimeLogsApiService: {
    updateEntry: (...args: unknown[]) => mocks.updateEntry(...args),
    update: (...args: unknown[]) => mocks.update(...args),
    create: (...args: unknown[]) => mocks.create(...args),
    getMyRecentProjects: vi.fn().mockResolvedValue({ done: true, body: [] }),
  },
}));

const ENTRY: EditableTimeEntry = {
  id: 'log-1',
  task_id: 'task-1',
  task_name: 'Write the report',
  project_id: 'project-1',
  project_name: 'Project One',
  user_id: 'u-me',
  user_name: 'Me',
  // Postgres NUMERIC arrives as a string at runtime, whatever the type says.
  time_spent: '5400',
  description: 'Draft',
  created_at: '2026-09-24T04:26:00.000Z',
};

const onClose = vi.fn();
const onSaved = vi.fn();

describe('EditTimeEntryModal with the real time-log form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateEntry.mockResolvedValue({ done: true });
  });

  it('shows the entry\'s saved values in a regular-size form with right-aligned buttons', async () => {
    render(<EditTimeEntryModal entry={ENTRY} onClose={onClose} onSaved={onSaved} />);

    const dialog = await screen.findByRole('dialog', { name: 'Edit time entry' });
    expect(await within(dialog).findByDisplayValue('Draft')).toBeInTheDocument();

    // Regular-size controls (the inline drawer form uses the small ones) ...
    expect(dialog.querySelector('.ant-picker-small')).toBeNull();
    expect(dialog.querySelector('.ant-picker')).not.toBeNull();
    // ... and the buttons sit on the right, like a modal footer.
    const buttons = within(dialog).getByRole('button', { name: /Update/ }).parentElement;
    expect(buttons?.className).toContain('ant-flex-justify-flex-end');
  });

  it('saves through the Time Entries endpoint - not the task drawer\'s - then reports the save', async () => {
    const user = userEvent.setup();
    render(<EditTimeEntryModal entry={ENTRY} onClose={onClose} onSaved={onSaved} />);

    const dialog = await screen.findByRole('dialog');
    const update = await within(dialog).findByRole('button', { name: /Update/ });
    await waitFor(() => expect(update).toBeEnabled());
    await user.click(update);

    await waitFor(() => expect(mocks.updateEntry).toHaveBeenCalledTimes(1));
    expect(mocks.updateEntry).toHaveBeenCalledWith(
      'log-1',
      expect.objectContaining({
        id: 'log-1',
        project_id: 'project-1',
        seconds_spent: 5400,
        description: 'Draft',
        formatted_start: '2026-09-24T04:26:00.000Z',
      })
    );
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('stays open and shows the server\'s reason when the save is refused', async () => {
    const user = userEvent.setup();
    mocks.updateEntry.mockRejectedValue({
      response: { data: { message: 'You can only edit your own time entries.' } },
    });
    render(<EditTimeEntryModal entry={ENTRY} onClose={onClose} onSaved={onSaved} />);

    const dialog = await screen.findByRole('dialog');
    const update = await within(dialog).findByRole('button', { name: /Update/ });
    await waitFor(() => expect(update).toBeEnabled());
    await user.click(update);

    expect(await within(dialog).findByText('You can only edit your own time entries.')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('TimeLogForm used by the task drawer (no inModal)', () => {
  it('keeps its compact look: small controls, left-aligned buttons', async () => {
    render(<TimeLogForm mode="create" taskId="task-1" projectId="project-1" onCancel={vi.fn()} />);

    const submit = await screen.findByRole('button', { name: /Log Time|logTime/i });
    expect(document.querySelector('.ant-picker-small')).not.toBeNull();
    expect(submit.parentElement?.className).not.toContain('ant-flex-justify-flex-end');
  });
});
