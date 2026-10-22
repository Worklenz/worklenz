import React from 'react';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TFunction } from 'i18next';
import { SocketEvents } from '@/shared/socket-events';
import taskAttachmentsApiService from '@/api/tasks/task-attachments.api.service';

const mockDrawerState = vi.hoisted(() => ({
  targetCommentId: null as string | null,
  selectedTaskId: 'task-1' as string | null,
  loadingTask: false,
  projectId: 'project-1' as string | null,
  taskFormViewModel: {
    task: { id: 'task-1', name: 'Test task', task_level: 0, sub_tasks_count: 0 },
  } as unknown,
  socketListeners: {} as Record<string, (payload: unknown) => void>,
}));

// Heavy drawer children are irrelevant to paste handling.
vi.mock('./description-editor', () => ({ default: () => <div data-testid="description-editor" /> }));
vi.mock('./subtask-table', () => ({ default: () => <div data-testid="subtask-table" /> }));
vi.mock('./dependencies-table', () => ({ default: () => <div data-testid="dependencies-table" /> }));
vi.mock('./task-details-form', () => ({ default: () => <div data-testid="task-details-form" /> }));
vi.mock('./comments/task-comments', () => ({ default: () => <div data-testid="task-comments" /> }));
vi.mock('./details/task-drawer-custom-fields/task-drawer-custom-fields', () => ({
  default: () => <div data-testid="task-custom-fields" />,
}));
vi.mock('./mentioned-in-docs', () => ({ default: () => <div data-testid="mentioned-in-docs" /> }));

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      themeReducer: { mode: 'light' },
      projectReducer: { projectId: mockDrawerState.projectId },
      taskDrawerReducer: {
        loadingTask: mockDrawerState.loadingTask,
        selectedTaskId: mockDrawerState.selectedTaskId,
        targetCommentId: mockDrawerState.targetCommentId,
        taskFormViewModel: mockDrawerState.taskFormViewModel,
      },
    }),
}));

vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({ getCurrentSession: () => ({ subscription_type: 'business' }) }),
}));
vi.mock('@/hooks/useAppSumoTracking', () => ({
  useAppSumoTracking: () => ({ trackAppSumoEvent: vi.fn() }),
}));
vi.mock('@/hooks/useMixpanelTracking', () => ({
  useMixpanelTracking: () => ({ trackMixpanelEvent: vi.fn() }),
}));
vi.mock('@/socket/socketContext', () => ({
  useSocket: () => ({
    socket: {
      on: (event: string, handler: (payload: unknown) => void) => {
        mockDrawerState.socketListeners[event] = handler;
      },
      off: (event: string) => {
        delete mockDrawerState.socketListeners[event];
      },
    },
    connected: true,
  }),
}));
vi.mock('@/utils/subscription-utils', () => ({ hasBusinessFeatureAccess: () => true }));

vi.mock('@/features/tasks/tasks.slice', () => ({ fetchTask: vi.fn(() => ({ type: 'tasks/fetchTask' })) }));
vi.mock('@/features/admin-center/admin-center.slice', () => ({
  toggleUpgradeModal: vi.fn(() => ({ type: 'ui/toggleUpgradeModal' })),
}));
vi.mock('@/features/task-management/task-management.slice', () => ({
  updateTaskCounts: vi.fn(() => ({ type: 'tm/updateTaskCounts' })),
}));

vi.mock('@/api/tasks/task-attachments.api.service', () => ({
  default: {
    getTaskAttachments: vi.fn().mockResolvedValue({ done: true, body: [] }),
    presignTaskAttachment: vi
      .fn()
      .mockResolvedValue({ done: true, body: { file_id: 'file-1', upload_url: 'https://upload.test' } }),
    uploadDirect: vi.fn().mockResolvedValue(undefined),
    confirmTaskAttachment: vi.fn().mockResolvedValue({ done: true, body: { id: 'attachment-1' } }),
  },
}));
vi.mock('@/api/tasks/task-comments.api.service', () => ({
  default: { getByTaskId: vi.fn().mockResolvedValue({ done: true, body: [] }) },
}));
vi.mock('@/api/tasks/subtasks.api.service', () => ({
  subTasksApiService: { getSubTasks: vi.fn().mockResolvedValue({ done: true, body: [] }) },
}));
vi.mock('@/api/tasks/task-dependencies.api.service', () => ({
  taskDependenciesApiService: {
    getTaskDependencies: vi.fn().mockResolvedValue({ done: true, body: [] }),
  },
}));

import TaskDrawerInfoTab from './task-drawer-info-tab';

const t = ((key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key) as TFunction;

const pasteFile = (target: Element) => {
  const file = new File([new Uint8Array(16)], 'pasted.txt', { type: 'text/plain' });
  const clipboardData = {
    items: [{ kind: 'file', getAsFile: () => file }],
    files: [file],
    types: ['Files'],
    getData: () => '',
  };
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });
  fireEvent(target, event);
};

describe('TaskDrawerInfoTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDrawerState.targetCommentId = null;
    mockDrawerState.selectedTaskId = 'task-1';
    mockDrawerState.loadingTask = false;
    mockDrawerState.projectId = 'project-1';
    mockDrawerState.taskFormViewModel = {
      task: { id: 'task-1', name: 'Test task', task_level: 0, sub_tasks_count: 0 },
    };
  });

  it('reveals the attachments section after a valid paste', async () => {
    const { container } = render(<TaskDrawerInfoTab t={t} canCreateTask />);

    const header = await screen.findByText('Attachments');
    const panel = header.closest('.ant-collapse-item') as HTMLElement;
    expect(panel).toHaveClass('ant-collapse-item-active');

    // Collapse the section the way a user would.
    fireEvent.click(header);
    await waitFor(() => expect(panel).not.toHaveClass('ant-collapse-item-active'));

    // The grid stays mounted while collapsed, so its paste listener is live.
    const grid = container.querySelector('.attachments-container') as HTMLElement;
    expect(grid).toBeTruthy();
    pasteFile(grid);

    await waitFor(() => expect(panel).toHaveClass('ant-collapse-item-active'));
  });

  it('expands the Comments section when a comment navigation target arrives', async () => {
    mockDrawerState.targetCommentId = null;
    const { rerender } = render(<TaskDrawerInfoTab t={t} canCreateTask />);

    const header = await screen.findByText('Comments');
    const panel = header.closest('.ant-collapse-item') as HTMLElement;
    fireEvent.click(header);
    await waitFor(() => expect(panel).not.toHaveClass('ant-collapse-item-active'));

    mockDrawerState.targetCommentId = 'comment-1';
    rerender(<TaskDrawerInfoTab t={t} canCreateTask />);

    await waitFor(() => expect(panel).toHaveClass('ant-collapse-item-active'));
    mockDrawerState.targetCommentId = null;
  });

  it('fetches and displays existing task attachments on initial load and retains them across loadingTask updates', async () => {
    const mockAttachments = [
      {
        id: 'att-1',
        name: 'specification.pdf',
        size: '2.4 MB',
        type: 'pdf',
        url: 'https://storage.test/spec.pdf',
        created_at: new Date().toISOString(),
      },
    ];
    vi.mocked(taskAttachmentsApiService.getTaskAttachments).mockResolvedValue({
      done: true,
      body: mockAttachments,
    });

    const { rerender } = render(<TaskDrawerInfoTab t={t} canCreateTask />);

    expect(taskAttachmentsApiService.getTaskAttachments).toHaveBeenCalledWith('task-1');
    expect(await screen.findByLabelText(/specification\.pdf/i)).toBeInTheDocument();

    // Simulate Redux loadingTask transitioning to true (fetchTask dispatched, drawer shows skeleton)
    mockDrawerState.loadingTask = true;
    rerender(<TaskDrawerInfoTab t={t} canCreateTask />);

    // Simulate Redux loadingTask transitioning back to false (fetchTask finished, skeleton hides)
    mockDrawerState.loadingTask = false;
    rerender(<TaskDrawerInfoTab t={t} canCreateTask />);
    expect(await screen.findByLabelText(/specification\.pdf/i)).toBeInTheDocument();
  });

  it('re-fetches attachments when TASK_ATTACHMENTS_UPDATED socket event is received for selected task', async () => {
    vi.mocked(taskAttachmentsApiService.getTaskAttachments).mockResolvedValue({
      done: true,
      body: [],
    });

    render(<TaskDrawerInfoTab t={t} canCreateTask />);
    await waitFor(() => {
      expect(taskAttachmentsApiService.getTaskAttachments).toHaveBeenCalledWith('task-1');
    });

    vi.mocked(taskAttachmentsApiService.getTaskAttachments).mockClear();

    const socketHandler = mockDrawerState.socketListeners[SocketEvents.TASK_ATTACHMENTS_UPDATED.toString()];
    expect(socketHandler).toBeDefined();

    // Socket event for a different task should be ignored
    act(() => {
      socketHandler('task-other');
    });
    expect(taskAttachmentsApiService.getTaskAttachments).not.toHaveBeenCalled();

    // Socket event for the open task should trigger re-fetch
    act(() => {
      socketHandler('task-1');
    });
    expect(taskAttachmentsApiService.getTaskAttachments).toHaveBeenCalledWith('task-1');
  });

  it('fetches new attachments when switching to a different task', async () => {
    vi.mocked(taskAttachmentsApiService.getTaskAttachments).mockResolvedValue({
      done: true,
      body: [],
    });

    const { rerender } = render(<TaskDrawerInfoTab t={t} canCreateTask />);
    await waitFor(() => {
      expect(taskAttachmentsApiService.getTaskAttachments).toHaveBeenCalledWith('task-1');
    });

    vi.mocked(taskAttachmentsApiService.getTaskAttachments).mockClear();

    mockDrawerState.selectedTaskId = 'task-2';
    rerender(<TaskDrawerInfoTab t={t} canCreateTask />);

    await waitFor(() => {
      expect(taskAttachmentsApiService.getTaskAttachments).toHaveBeenCalledWith('task-2');
    });
  });
});
