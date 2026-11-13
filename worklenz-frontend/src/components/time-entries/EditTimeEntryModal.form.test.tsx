import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimeLogForm from '@/components/task-drawer/shared/time-log/time-log-form';
import { EditTimeEntryModal, type EditableTimeEntry } from './EditTimeEntryModal';

// The REAL time-log form inside the REAL modal - only the store, socket and HTTP layer are stubbed.
// This is the path a user takes: open Edit, change nothing (or something), press Update.
const mocks = vi.hoisted(() => ({
  updateEntry: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  splitEntry: vi.fn(),
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
      projectReducer: { project: null },
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
    splitEntry: (...args: unknown[]) => mocks.splitEntry(...args),
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
    mocks.splitEntry.mockResolvedValue({ done: true });
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

  it('preserves the calendar span when reopening an existing 25-hour log without collapsing to 1 hour', async () => {
    const user = userEvent.setup();
    const ENTRY_25H: EditableTimeEntry = {
      id: 'log-25h',
      task_id: 'task-1',
      task_name: 'Write the report',
      project_id: 'project-1',
      project_name: 'Project One',
      user_id: 'u-me',
      user_name: 'Me',
      time_spent: '90000', // 25 hours (10:00 Day 1 to 11:00 Day 2)
      description: 'Long run',
      created_at: '2026-09-24T10:00:00.000Z',
    };

    render(<EditTimeEntryModal entry={ENTRY_25H} onClose={onClose} onSaved={onSaved} />);

    const dialog = await screen.findByRole('dialog');
    const update = await within(dialog).findByRole('button', { name: /Update/ });
    await waitFor(() => expect(update).toBeEnabled());
    await user.click(update);

    await waitFor(() => expect(mocks.splitEntry).toHaveBeenCalledTimes(1));
    expect(mocks.splitEntry).toHaveBeenCalledWith(
      'log-25h',
      expect.objectContaining({
        seconds_spent: expect.any(Number),
        description: 'Long run',
      }),
      expect.objectContaining({
        seconds_spent: expect.any(Number),
      })
    );
    const call1Args = mocks.splitEntry.mock.calls[0];
    expect(call1Args[1].seconds_spent + call1Args[2].seconds_spent).toBe(90000);
    // Crucially: never collapsed to 3,600 seconds!
    expect(mocks.updateEntry).not.toHaveBeenCalledWith(
      'log-25h',
      expect.objectContaining({ seconds_spent: 3600 })
    );
  });

  it('preserves the original author when an admin turns another member\'s entry into an overnight split', async () => {
    const user = userEvent.setup();
    const MEMBER_ENTRY: EditableTimeEntry = {
      id: 'log-member-1',
      task_id: 'task-1',
      task_name: 'Member Task',
      project_id: 'project-1',
      project_name: 'Project One',
      user_id: 'u-other-member',
      user_name: 'Alice Member',
      time_spent: '90000',
      description: 'Overnight work by Alice',
      created_at: '2026-09-24T10:00:00.000Z',
    };

    render(<EditTimeEntryModal entry={MEMBER_ENTRY} onClose={onClose} onSaved={onSaved} />);

    const dialog = await screen.findByRole('dialog');
    const update = await within(dialog).findByRole('button', { name: /Update/ });
    await waitFor(() => expect(update).toBeEnabled());
    await user.click(update);

    // Uses splitEntry rather than creating a new log via ordinary create route
    // (which would attribute the second day to req.user.id).
    await waitFor(() => expect(mocks.splitEntry).toHaveBeenCalledTimes(1));
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.splitEntry).toHaveBeenCalledWith(
      'log-member-1',
      expect.objectContaining({
        seconds_spent: expect.any(Number),
        description: 'Overnight work by Alice',
      }),
      expect.objectContaining({
        seconds_spent: expect.any(Number),
      })
    );
    const call2Args = mocks.splitEntry.mock.calls[0];
    expect(call2Args[1].seconds_spent + call2Args[2].seconds_spent).toBe(90000);
  });
});

describe('TimeLogForm used by the task drawer (no inModal)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps its compact look: small controls, left-aligned buttons', async () => {
    render(<TimeLogForm mode="create" taskId="task-1" projectId="project-1" onCancel={vi.fn()} />);

    const submit = await screen.findByRole('button', { name: /Log Time|logTime/i });
    expect(document.querySelector('.ant-picker-small')).not.toBeNull();
    expect(submit.parentElement?.className).not.toContain('ant-flex-justify-flex-end');
  });

  it('supports overnight time entries where end date is on the next day', async () => {
    const user = userEvent.setup();
    const OVERNIGHT_ENTRY: EditableTimeEntry = {
      id: 'log-overnight',
      task_id: 'task-1',
      project_id: 'project-1',
      user_id: 'u-me',
      time_spent: '16200', // 4.5 hours
      description: 'Overnight deploy',
      created_at: '2026-09-24T22:00:00.000Z',
    };

    render(
      <TimeLogForm
        mode="edit"
        initialValues={{
          id: OVERNIGHT_ENTRY.id,
          project_id: OVERNIGHT_ENTRY.project_id,
          created_at: '2026-09-24T22:00:00.000Z',
          start_time: '2026-09-24T22:00:00.000Z',
          end_time: '2026-09-25T02:30:00.000Z',
          description: OVERNIGHT_ENTRY.description,
        }}
        onCancel={vi.fn()}
      />
    );

    const updateBtn = await screen.findByRole('button', { name: /Update/i });
    await waitFor(() => expect(updateBtn).toBeEnabled());
    await user.click(updateBtn);

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update).toHaveBeenCalledWith(
      'log-overnight',
      expect.objectContaining({
        id: 'log-overnight',
        project_id: 'project-1',
        seconds_spent: 16200, // 4 hours 30 minutes across midnight
        description: 'Overnight deploy',
      })
    );
  });

  it('automatically treats end time earlier than start time as overnight (+1 day) with single date', async () => {
    const user = userEvent.setup();
    render(
      <TimeLogForm
        mode="edit"
        projectId="project-1"
        initialValues={{
          id: 'log-cross-midnight',
          project_id: 'project-1',
          created_at: '2026-09-24T22:00:00.000Z',
          start_time: '2026-09-24T22:00:00.000Z',
          end_time: '2026-09-25T02:00:00.000Z',
          description: 'Night work',
        }}
        onCancel={vi.fn()}
      />
    );

    const updateBtn = await screen.findByRole('button', { name: /Update/i });
    await waitFor(() => expect(updateBtn).toBeEnabled());

    // Should display live duration tag showing 4h 0m
    expect(await screen.findByText(/4h 0m/)).toBeInTheDocument();

    await user.click(updateBtn);

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(mocks.update).toHaveBeenCalledWith(
      'log-cross-midnight',
      expect.objectContaining({
        id: 'log-cross-midnight',
        project_id: 'project-1',
        seconds_spent: 14400, // 4 hours
        description: 'Night work',
      })
    );
  });

  it('splits overnight entry across midnight into two entries when creating', async () => {
    const user = userEvent.setup();
    mocks.create.mockResolvedValue({ done: true });

    render(
      <TimeLogForm
        mode="create"
        taskId="task-1"
        projectId="project-1"
        onCancel={vi.fn()}
      />
    );

    // Switch to Time Range
    fireEvent.click(screen.getByText('Time Range'));

    const inputs = screen.getAllByRole('textbox');
    // inputs[0]: DatePicker, inputs[1]: startTime, inputs[2]: endTime
    fireEvent.change(inputs[1], { target: { value: '22:00' } });
    fireEvent.keyDown(inputs[1], { key: 'Enter', code: 'Enter' });

    fireEvent.change(inputs[2], { target: { value: '02:00' } });
    fireEvent.keyDown(inputs[2], { key: 'Enter', code: 'Enter' });

    expect(await screen.findByText(/4h 0m/)).toBeInTheDocument();
    expect(screen.queryByText(/2h 0m.*2h 0m/)).toBeNull();

    const submitBtn = await screen.findByRole('button', { name: /Log Time|logTime/i });
    await waitFor(() => expect(submitBtn).toBeEnabled());
    await user.click(submitBtn);

    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        id: 'task-1',
        project_id: 'project-1',
        seconds_spent: 7200, // 2 hours on Day 1
      })
    );
    expect(mocks.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: 'task-1',
        project_id: 'project-1',
        seconds_spent: 7200, // 2 hours on Day 2
      })
    );
  });

  it('preserves 25-hour elapsed duration when switching between timeRange and duration modes', async () => {
    render(
      <TimeLogForm
        mode="edit"
        projectId="project-1"
        initialValues={{
          id: 'log-25h-drawer',
          project_id: 'project-1',
          created_at: '2026-09-24T10:00:00.000Z',
          start_time: '2026-09-24T10:00:00.000Z',
          end_time: '2026-09-25T11:00:00.000Z',
          time_spent: 90000,
          description: '25h drawer',
        }}
        onCancel={vi.fn()}
      />
    );

    // Initial timeRange shows 25h 0m tag
    expect(await screen.findByText(/25h 0m/)).toBeInTheDocument();

    // Switch to Duration mode
    fireEvent.click(screen.getByText('Duration'));

    // Hours input should have value 25
    const inputs = screen.getAllByRole('spinbutton');
    // inputs[0] is hours, inputs[1] is minutes
    expect(inputs[0]).toHaveValue('25');
    expect(inputs[1]).toHaveValue('0');

    // Switch back to Time Range mode
    fireEvent.click(screen.getByText('Time Range'));
    expect(await screen.findByText(/25h 0m/)).toBeInTheDocument();
  });
});
