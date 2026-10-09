import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditTimeEntryModal, type EditableTimeEntry } from './EditTimeEntryModal';

// Ant Design's Modal is real; only app-level collaborators are mocked.
const mocks = vi.hoisted(() => ({
  session: { id: 'u-me' },
  seenInitialValues: [] as unknown[],
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
  useAuthService: () => ({ getCurrentSession: () => mocks.session }),
}));
vi.mock('@/components/task-drawer/shared/time-log/time-log-form', () => ({
  default: (props: {
    asTimeEntry?: boolean;
    inModal?: boolean;
    taskId?: string;
    projectId?: string;
    mode?: string;
    initialValues?: { id?: string; time_spent?: number; description?: string };
    onCancel: () => void;
    onSubmitSuccess?: () => void;
  }) => {
    mocks.seenInitialValues.push(props.initialValues);
    return (
      <div
        data-testid="time-log-form"
        data-mode={props.mode}
        data-as-time-entry={String(!!props.asTimeEntry)}
        data-in-modal={String(!!props.inModal)}
        data-task-id={props.taskId}
        data-project-id={props.projectId}
        data-time-spent={String(props.initialValues?.time_spent)}
        data-description={props.initialValues?.description}
      >
        <button type="button" onClick={props.onSubmitSuccess}>
          stub-save
        </button>
        <button type="button" onClick={props.onCancel}>
          stub-cancel
        </button>
      </div>
    );
  },
}));

const makeEntry = (overrides: Partial<EditableTimeEntry> = {}): EditableTimeEntry => ({
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
  ...overrides,
});

const onClose = vi.fn();
const onSaved = vi.fn();

const renderModal = (entry: EditableTimeEntry | null) =>
  render(<EditTimeEntryModal entry={entry} onClose={onClose} onSaved={onSaved} />);

describe('EditTimeEntryModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = { id: 'u-me' };
    mocks.seenInitialValues.length = 0;
  });

  it('renders nothing while no entry is being edited', () => {
    renderModal(null);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByTestId('time-log-form')).not.toBeInTheDocument();
  });

  it('shows a titled dialog with the task and project for context', async () => {
    renderModal(makeEntry());

    const dialog = await screen.findByRole('dialog', { name: 'Edit time entry' });
    expect(within(dialog).getByText('Write the report')).toBeInTheDocument();
    expect(within(dialog).getByText('Project One')).toBeInTheDocument();
  });

  it('hands the form the entry as an edit through the Time Entries endpoint, with numeric seconds', async () => {
    renderModal(makeEntry());

    const form = await screen.findByTestId('time-log-form');
    expect(form).toHaveAttribute('data-mode', 'edit');
    expect(form).toHaveAttribute('data-as-time-entry', 'true');
    expect(form).toHaveAttribute('data-in-modal', 'true');
    expect(form).toHaveAttribute('data-task-id', 'task-1');
    expect(form).toHaveAttribute('data-project-id', 'project-1');
    expect(form).toHaveAttribute('data-time-spent', '5400');
    expect(form).toHaveAttribute('data-description', 'Draft');
  });

  it('says whose entry it is only when it is somebody else\'s', async () => {
    const { unmount } = renderModal(makeEntry({ user_id: 'u-other', user_name: 'Jamie Lee' }));
    expect(await screen.findByText('Logged by Jamie Lee')).toBeInTheDocument();
    unmount();

    renderModal(makeEntry({ user_id: 'u-me', user_name: 'Me' }));
    await screen.findByRole('dialog');
    expect(screen.queryByText(/Logged by/)).not.toBeInTheDocument();
  });

  it('keeps the form\'s initial values stable across re-renders of the same entry', async () => {
    const { rerender } = renderModal(makeEntry());
    await screen.findByTestId('time-log-form');

    // A background refetch hands back a fresh object with identical values.
    rerender(<EditTimeEntryModal entry={makeEntry()} onClose={onClose} onSaved={onSaved} />);

    const distinct = new Set(mocks.seenInitialValues.filter(Boolean));
    expect(distinct.size).toBe(1);
  });

  it('reports a save through onSaved and a cancel through onClose', async () => {
    const user = userEvent.setup();
    renderModal(makeEntry());

    await user.click(await screen.findByRole('button', { name: 'stub-save' }));
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'stub-cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the header close button and Escape, but not from a click on the backdrop', async () => {
    const user = userEvent.setup();
    renderModal(makeEntry());
    await screen.findByRole('dialog');

    const mask = document.querySelector<HTMLElement>('.ant-modal-wrap');
    if (!mask) throw new Error('modal wrapper not found');
    await user.click(mask);
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));

    // jsdom doesn't move focus into the dialog, so send the key to it directly.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape', keyCode: 27 });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
  });
});
