import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigProvider, theme } from 'antd';
import { TFunction } from 'i18next';
import DependenciesTable from './dependencies-table';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import { taskDependenciesApiService } from '@/api/tasks/task-dependencies.api.service';
import { ITaskViewModel } from '@/types/tasks/task.types';
import { IDependencyType } from '@/types/tasks/task-dependency.types';

vi.mock('@/shared/antd-imports', async () => ({
  ...(await import('antd')),
  ...(await import('@ant-design/icons')),
}));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: () => ({ projectId: 'project-1' }),
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('@/features/task-management/task-management.slice', () => ({ updateTaskCounts: vi.fn() }));
vi.mock('@/pages/projects/projectView/gantt/services/roadmap-api.service', () => ({
  roadmapApi: { util: { invalidateTags: vi.fn() } },
}));
vi.mock('@/api/tasks/tasks.api.service', () => ({ tasksApiService: { searchTask: vi.fn() } }));
vi.mock('@/api/tasks/task-dependencies.api.service', () => ({
  taskDependenciesApiService: { createTaskDependency: vi.fn() },
}));

const t = ((key: string) => key) as TFunction;

describe('dependency task selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tasksApiService.searchTask).mockResolvedValue({
      done: true,
      body: [{ label: 'Available task', value: 'related-task' }],
    });
    vi.mocked(taskDependenciesApiService.createTaskDependency).mockResolvedValue({
      done: true,
      body: {
        task_id: 'task-1',
        related_task_id: 'related-task',
        dependency_type: IDependencyType.BLOCKED_BY,
      },
    });
  });

  it.each(['light', 'dark'])('loads and selects tasks without typing in %s theme', async mode => {
    const user = userEvent.setup();
    const refreshTaskDependencies = vi.fn();
    render(
      <ConfigProvider theme={{ algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm }}>
        <DependenciesTable
          task={{ id: 'task-1' } as ITaskViewModel}
          t={t}
          taskDependencies={[]}
          loadingTaskDependencies={false}
          refreshTaskDependencies={refreshTaskDependencies}
        />
      </ConfigProvider>
    );

    await user.click(screen.getByRole('button', { name: 'taskInfoTab.dependencies.addDependency' }));
    await user.click(screen.getByRole('combobox'));
    await waitFor(() => expect(tasksApiService.searchTask).toHaveBeenCalledWith('task-1', 'project-1', ''));
    await user.click(await screen.findByText('Available task'));
    await waitFor(() => expect(taskDependenciesApiService.createTaskDependency).toHaveBeenCalledWith(
      expect.objectContaining({ task_id: 'task-1', related_task_id: 'related-task' })
    ));
    expect(refreshTaskDependencies).toHaveBeenCalled();
  });
});
