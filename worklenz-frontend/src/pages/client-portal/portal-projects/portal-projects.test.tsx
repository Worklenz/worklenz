import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../discussions/RichMessageEditor', async () => {
  const { RichMessageEditorStub } = await import('../discussions/richMessageEditorStub');
  return { RichMessageEditor: RichMessageEditorStub };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: Record<string, unknown>) =>
      String(options?.defaultValue ?? '').replace(/{{(\w+)}}/g, (_match, name: string) =>
        String(options?.[name] ?? '')
      ),
    i18n: { language: 'en' },
  }),
}));

const state = vi.hoisted(() => ({
  setPortal: vi.fn(),
  updateMilestone: vi.fn(),
  deleteMilestone: vi.fn(),
  updateTask: vi.fn(),
  milestones: [] as unknown[],
  /** 'manual' = milestones staff maintain here; 'worklenz' = the project's own phases. */
  milestoneSource: 'manual' as 'manual' | 'worklenz',
  tasks: { items: [] as unknown[], counts: { all: 0, client: 0, internal: 0 }, total: 0 },
  files: [] as unknown[],
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
}));

const trigger =
  (fn: (...args: unknown[]) => unknown) =>
  (...args: unknown[]) => {
    const promise = Promise.resolve().then(() => fn(...args));
    return Object.assign(promise, { unwrap: () => promise });
  };

vi.mock('@/api/client-portal/portal-projects-api', () => ({
  useSetPortalProjectPortalMutation: () => [trigger(state.setPortal), { isLoading: false }],
  useGetProjectMilestonesQuery: () => ({ data: { body: state.milestones }, isLoading: false, isError: false, refetch: vi.fn() }),
  // The Milestones tab reads the project's milestone source (manual milestones vs. Worklenz phases).
  useGetProjectOverviewQuery: () => ({
    data: { body: { milestone_source: state.milestoneSource } },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useSaveProjectOverviewMutation: () => [trigger(vi.fn()), { isLoading: false }],
  useUpdateMilestoneMutation: () => [trigger(state.updateMilestone), { isLoading: false }],
  useDeleteMilestoneMutation: () => [trigger(state.deleteMilestone), { isLoading: false }],
  useCreateMilestoneMutation: () => [trigger(vi.fn()), { isLoading: false }],
  useCompleteMilestoneMutation: () => [trigger(vi.fn()), { isLoading: false }],
  useGetProjectTasksQuery: () => ({
    data: { body: { ...state.tasks, page: 1, limit: 10 } },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useUpdatePortalTaskMutation: () => [trigger(state.updateTask), { isLoading: false }],
  useGetProjectFilesQuery: () => ({ data: { body: state.files }, isLoading: false, isError: false, refetch: vi.fn() }),
}));

vi.mock('@/shared/antd-imports', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/antd-imports')>();
  return {
    ...actual,
    message: { success: state.messageSuccess, error: state.messageError, warning: vi.fn(), info: vi.fn() },
  };
});

import type { Milestone, PortalProject, PortalTask } from '@/types/client-portal/v2';
import { PortalSwitch } from '@/components/client-portal/v2/PortalSwitch';
import { MilestonesTab } from './tabs/MilestonesTab';
import { TasksTab } from './tabs/TasksTab';

const project: PortalProject = {
  id: 'p-1',
  name: 'Website redesign',
  color: '#1677ff',
  organization_id: 'org-1',
  organization_name: 'Brandbase',
  portal_enabled: true,
  status: 'on_track',
  phase: 'Design',
  progress: 40,
  next_milestone: null,
  active_client_users: 3,
};

const makeMilestone = (overrides: Partial<Milestone> = {}): Milestone => ({
  id: 'm-1',
  project_id: 'p-1',
  name: 'Design approved',
  description: '',
  target_date: '2026-07-01',
  completed_at: null,
  status: 'upcoming',
  visibility: 'internal',
  completion_note: '',
  internal_note: 'Slipping because of the vendor',
  linked: { task_ids: [], file_ids: [] },
  linked_visible_count: 0,
  linked_total_count: 0,
  ...overrides,
});

const makeTask = (overrides: Partial<PortalTask> = {}): PortalTask => ({
  id: 't-1',
  key: 'WL-231',
  project_id: 'p-1',
  title: 'Refactor checkout flow',
  status: 'todo',
  due_date: null,
  assignee: null,
  visibility: 'internal',
  client_title: '',
  client_description: '',
  attached_file_ids: [],
  never_shared: { estimate_hours: 12, logged_hours: 3, internal_comments: 2 },
  ...overrides,
});

const inRouter = (node: React.ReactNode) => render(<MemoryRouter>{node}</MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  state.setPortal.mockResolvedValue({ body: { affected_users: 3 } });
  state.updateMilestone.mockResolvedValue({ body: {} });
  state.deleteMilestone.mockResolvedValue({ body: null });
  state.updateTask.mockResolvedValue({ body: {} });
  state.milestones = [makeMilestone()];
  state.tasks = { items: [makeTask()], counts: { all: 1, client: 0, internal: 1 }, total: 1 };
  state.files = [];
});

describe('PortalSwitch', () => {
  it('asks before switching the portal off and names how many client users lose access', async () => {
    render(<PortalSwitch project={project} />);

    await userEvent.click(screen.getByRole('switch', { name: 'Client Portal: Website redesign' }));

    expect(await screen.findByText('Turn the Client Portal off for this project?')).toBeInTheDocument();
    expect(screen.getByText(/Website redesign disappears from the portal for 3 active client user/)).toBeInTheDocument();
    expect(state.setPortal).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Turn off portal' }));
    await waitFor(() => expect(state.setPortal).toHaveBeenCalledWith({ projectId: 'p-1', enabled: false }));
  });

  it('switches on without a confirmation', async () => {
    render(<PortalSwitch project={{ ...project, portal_enabled: false }} />);

    await userEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(state.setPortal).toHaveBeenCalledWith({ projectId: 'p-1', enabled: true }));
  });

  it('cannot be switched on for a project that has no client yet', () => {
    render(<PortalSwitch project={{ ...project, organization_id: null, portal_enabled: false }} />);

    expect(screen.getByRole('switch')).toBeDisabled();
  });
});

describe('MilestonesTab', () => {
  it('shows an Internal Only milestone with its private note and counts what is shared', () => {
    inRouter(<MilestonesTab project={project} />);

    // The note is rich text, so the label and the note itself are separate elements.
    const note = screen.getByText('Slipping because of the vendor');
    expect(note.closest('div')?.textContent).toContain('Internal:');
    expect(
      screen.getByText(/0 shared with the client · 1 internal only/)
    ).toBeInTheDocument();
  });

  it('shares a milestone with the client from its switch', async () => {
    inRouter(<MilestonesTab project={project} />);

    await userEvent.click(screen.getByRole('switch', { name: 'Client visible: Design approved' }));

    await waitFor(() =>
      expect(state.updateMilestone).toHaveBeenCalledWith({
        projectId: 'p-1',
        milestoneId: 'm-1',
        body: { visibility: 'client' },
      })
    );
    await waitFor(() =>
      expect(state.messageSuccess).toHaveBeenCalledWith('“Design approved” is now visible to the client.')
    );
  });

  it('confirms a deletion and says it is audited', async () => {
    inRouter(<MilestonesTab project={project} />);

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Design approved' }));
    await userEvent.click(await screen.findByText('Delete milestone'));

    expect(await screen.findByText('Delete this milestone?')).toBeInTheDocument();
    expect(screen.getByText(/The deletion is recorded in the audit log/)).toBeInTheDocument();
    expect(state.deleteMilestone).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete milestone' }));
    await waitFor(() =>
      expect(state.deleteMilestone).toHaveBeenCalledWith({ projectId: 'p-1', milestoneId: 'm-1' })
    );
  });
});

describe('TasksTab', () => {
  it('lists tasks as Hidden until shared, with the visibility counts', () => {
    inRouter(<TasksTab project={project} />);

    expect(screen.getByText('Refactor checkout flow')).toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(screen.getByText('Client visible (0)')).toBeInTheDocument();
    expect(screen.getByText('Internal only (1)')).toBeInTheDocument();
  });

  it('shares a task from its switch without opening the drawer', async () => {
    inRouter(<TasksTab project={project} />);

    await userEvent.click(screen.getByRole('switch', { name: 'Client visible: Refactor checkout flow' }));

    await waitFor(() =>
      expect(state.updateTask).toHaveBeenCalledWith({ projectId: 'p-1', taskId: 't-1', body: { visibility: 'client' } })
    );
    expect(screen.queryByText('Never shared with the client')).not.toBeInTheDocument();
  });

  it('opens the drawer from the row, listing what is never shared and saying an Internal task does not exist in the portal', async () => {
    inRouter(<TasksTab project={project} />);

    await userEvent.click(screen.getByText('Refactor checkout flow'));

    expect(await screen.findByText('Never shared with the client')).toBeInTheDocument();
    expect(screen.getByText('Internal Only. This task does not exist in the portal.')).toBeInTheDocument();
    expect(screen.getByText('Time estimate')).toBeInTheDocument();
    expect(screen.getByText('12 h')).toBeInTheDocument();
  });

  it('round-trips a custom title that contains literal entity text when saving attachments or visibility', async () => {
    // client_title is plain text — "&amp;" must not become "&" on a save that does not edit the title.
    const entityTitle = 'Explain &amp;';
    state.tasks = {
      items: [
        makeTask({
          client_title: entityTitle,
          attached_file_ids: [],
        }),
      ],
      counts: { all: 1, client: 0, internal: 1 },
      total: 1,
    };
    state.files = [
      {
        id: 'f-1',
        project_id: 'p-1',
        name: 'spec.pdf',
        category: 'Deliverable',
        visibility: 'client',
        source: 'team',
        uploaded_by: 'Staff',
        uploaded_at: '2026-07-01T00:00:00.000Z',
        size_label: '12 KB',
        current_version: 1,
        version_count: 1,
      },
    ];

    inRouter(<TasksTab project={project} />);

    await userEvent.click(screen.getByText('Refactor checkout flow'));

    const titleInput = await screen.findByRole('textbox', { name: 'Client-facing title' });
    expect(titleInput).toHaveValue(entityTitle);

    // Change attachments and visibility without editing the title.
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('radio', { name: 'Client visible' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(state.updateTask).toHaveBeenCalledWith({
        projectId: 'p-1',
        taskId: 't-1',
        body: {
          visibility: 'client',
          client_title: entityTitle,
          client_description: '',
          attached_file_ids: ['f-1'],
        },
      })
    );
  });
});
