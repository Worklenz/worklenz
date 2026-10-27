import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  updateType: vi.fn(),
  messageError: vi.fn(),
  getState: vi.fn(() => ({ taskManagement: { entities: {} } })),
}));

vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => mocks.dispatch }));

vi.mock('react-redux', async () => {
  const actual = await vi.importActual<typeof import('react-redux')>('react-redux');
  return {
    ...actual,
    useStore: () => ({ getState: mocks.getState, dispatch: mocks.dispatch }),
  };
});

vi.mock('@/api/software-issues/software-issues.api.service', () => ({
  softwareIssuesApiService: {
    updateType: (...args: unknown[]) => mocks.updateType(...args),
  },
}));

vi.mock('@/shared/antd-imports', async () => {
  const actual = await vi.importActual<typeof import('@/shared/antd-imports')>(
    '@/shared/antd-imports'
  );
  return {
    ...actual,
    message: { error: mocks.messageError },
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

vi.mock('@/components/projects/software/issue-type-badge', () => ({
  IssueTypeBadge: ({ type }: { type: string }) => <span data-testid={`badge-${type}`}>{type}</span>,
  getIssueTypeLabel: (type: string) => type,
}));

import { resetIssueTypeSaveStateForTests } from '@/lib/project/issue-type-update';
import { TaskDrawerIssueIdentity } from './task-drawer-issue-identity';

describe('TaskDrawerIssueIdentity', () => {
  beforeEach(() => {
    resetIssueTypeSaveStateForTests();
    Object.values(mocks).forEach(fn => {
      if (typeof fn === 'function' && 'mockReset' in fn) fn.mockReset();
    });
    mocks.getState.mockReturnValue({ taskManagement: { entities: {} } });
    mocks.updateType.mockResolvedValue({ done: true, body: { id: 'task-1', issue_type: 'bug' } });
  });

  it('shows a static subtask badge without a type menu', () => {
    render(
      <TaskDrawerIssueIdentity
        taskId="task-1"
        projectId="project-1"
        taskKey="SW-1"
        issueType="task"
        isSubTask
      />
    );

    expect(screen.getByTestId('badge-subtask')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change issue type' })).not.toBeInTheDocument();
  });

  it('changes the issue type from the drawer header dropdown', async () => {
    render(
      <TaskDrawerIssueIdentity
        taskId="task-1"
        projectId="project-1"
        taskKey="SW-1"
        issueType="task"
        isSubTask={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change issue type' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /bug/i }));

    await waitFor(() =>
      expect(mocks.updateType).toHaveBeenCalledWith('project-1', 'task-1', 'bug')
    );
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.stringContaining('setTaskIssueType'),
        payload: { id: 'task-1', issue_type: 'bug' },
      })
    );
  });

  it('rolls back and shows an error when saving fails', async () => {
    mocks.updateType.mockResolvedValueOnce({ done: false, message: 'failed' });

    render(
      <TaskDrawerIssueIdentity
        taskId="task-1"
        projectId="project-1"
        issueType="story"
        isSubTask={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Change issue type' }));
    fireEvent.click((await screen.findByTestId('badge-task')).closest('[role="menuitem"]')!);

    await waitFor(() => expect(mocks.messageError).toHaveBeenCalled());
    await waitFor(() =>
      expect(mocks.dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: expect.stringContaining('setTaskIssueType'),
          payload: { id: 'task-1', issue_type: 'story' },
        })
      )
    );
  });
});
