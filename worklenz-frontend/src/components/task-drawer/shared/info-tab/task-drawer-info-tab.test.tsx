import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { TFunction } from 'i18next';

// Heavy drawer children are irrelevant to paste handling.
vi.mock('./description-editor', () => ({ default: () => <div data-testid="description-editor" /> }));
vi.mock('./subtask-table', () => ({ default: () => <div data-testid="subtask-table" /> }));
vi.mock('./dependencies-table', () => ({ default: () => <div data-testid="dependencies-table" /> }));
vi.mock('./task-details-form', () => ({ default: () => <div data-testid="task-details-form" /> }));
vi.mock('./comments/task-comments', () => ({ default: () => <div data-testid="task-comments" /> }));
vi.mock('./details/task-drawer-custom-fields/task-drawer-custom-fields', () => ({
  default: () => <div data-testid="task-custom-fields" />,
}));

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      themeReducer: { mode: 'light' },
      projectReducer: { projectId: 'project-1' },
      taskDrawerReducer: {
        loadingTask: false,
        selectedTaskId: 'task-1',
        taskFormViewModel: {
          task: { id: 'task-1', name: 'Test task', task_level: 0, sub_tasks_count: 0 },
        },
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
vi.mock('@/socket/socketContext', () => ({ useSocket: () => ({ socket: null, connected: false }) }));
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

describe('TaskDrawerInfoTab paste handling', () => {
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
});
