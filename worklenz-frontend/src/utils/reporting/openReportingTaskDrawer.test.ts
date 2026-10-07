import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/features/project/project.slice', () => ({
  setProjectId: vi.fn((payload: string) => ({ type: 'project/setProjectId', payload })),
  getProject: vi.fn((projectId: string) => ({ type: 'project/getProject', meta: { projectId } })),
}));

vi.mock('@/features/projects/singleProject/phase/phases.slice', () => ({
  fetchPhasesByProjectId: vi.fn((projectId: string) => ({
    type: 'phases/fetchPhasesByProjectId',
    meta: { projectId },
  })),
}));

vi.mock('@/features/task-drawer/task-drawer.slice', () => ({
  setTaskFormViewModel: vi.fn((payload: unknown) => ({ type: 'taskDrawer/setTaskFormViewModel', payload })),
  setSelectedTaskId: vi.fn((payload: string) => ({ type: 'taskDrawer/setSelectedTaskId', payload })),
  setShowTaskDrawer: vi.fn((payload: boolean) => ({ type: 'taskDrawer/setShowTaskDrawer', payload })),
  fetchTask: vi.fn((arg: { taskId: string; projectId: string }) => ({
    type: 'tasks/fetchTask',
    meta: arg,
  })),
}));

import { openReportingTaskDrawer, ReportingTaskRow } from './openReportingTaskDrawer';

const PROJECT_ID = 'project-1';

const buildTask = (overrides: Partial<ReportingTaskRow> = {}): ReportingTaskRow => ({
  id: 'task-1',
  name: 'Write report',
  status_id: 'status-1',
  status_name: 'To Do',
  status_color: '#cccccc',
  priority_id: 'priority-1',
  priority_name: 'Medium',
  priority_color: '#fadb14',
  phase_id: 'phase-1',
  phase_name: 'Design',
  phase_color: '#722ed1',
  end_date: '2026-10-01',
  parent_task_id: null,
  is_sub_task: false,
  sub_tasks_count: 2,
  task_key: 'IT-1',
  ...overrides,
});

describe('openReportingTaskDrawer', () => {
  let dispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dispatch = vi.fn();
  });

  const dispatchedTypes = () => dispatch.mock.calls.map(([action]) => action.type);

  it('seeds the drawer, starts project/phase/task fetches and opens the drawer in order', () => {
    openReportingTaskDrawer(dispatch as never, buildTask(), PROJECT_ID);

    expect(dispatchedTypes()).toEqual([
      'project/setProjectId',
      'taskDrawer/setTaskFormViewModel',
      'taskDrawer/setSelectedTaskId',
      'phases/fetchPhasesByProjectId',
      'project/getProject',
      'tasks/fetchTask',
      'taskDrawer/setShowTaskDrawer',
    ]);

    expect(dispatch).toHaveBeenCalledWith({ type: 'project/setProjectId', payload: PROJECT_ID });
    expect(dispatch).toHaveBeenCalledWith({ type: 'taskDrawer/setSelectedTaskId', payload: 'task-1' });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'phases/fetchPhasesByProjectId',
      meta: { projectId: PROJECT_ID },
    });
    expect(dispatch).toHaveBeenCalledWith({ type: 'project/getProject', meta: { projectId: PROJECT_ID } });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'tasks/fetchTask',
      meta: { taskId: 'task-1', projectId: PROJECT_ID },
    });
    expect(dispatch).toHaveBeenCalledWith({ type: 'taskDrawer/setShowTaskDrawer', payload: true });
  });

  it('seeds the form view model from the report row so the drawer renders before the fetch resolves', () => {
    openReportingTaskDrawer(dispatch as never, buildTask(), PROJECT_ID);

    const seedAction = dispatch.mock.calls
      .map(([action]) => action)
      .find(action => action.type === 'taskDrawer/setTaskFormViewModel');

    expect(seedAction.payload.task).toEqual(
      expect.objectContaining({
        id: 'task-1',
        name: 'Write report',
        project_id: PROJECT_ID,
        status_id: 'status-1',
        priority_id: 'priority-1',
        phase_id: 'phase-1',
        end_date: '2026-10-01',
        parent_task_id: null,
        sub_tasks_count: 2,
        task_key: 'IT-1',
      })
    );
    expect(seedAction.payload.phases).toEqual([
      { id: 'phase-1', name: 'Design', color_code: '#722ed1', sort_index: 0 },
    ]);
    expect(seedAction.payload.statuses).toEqual([]);
  });

  it('falls back to legacy status/priority fields and omits phases without a phase name', () => {
    openReportingTaskDrawer(
      dispatch as never,
      buildTask({
        status_id: undefined,
        status: 'legacy-status',
        priority_id: undefined,
        priority: 'legacy-priority',
        phase_name: undefined,
      }),
      PROJECT_ID
    );

    const seedAction = dispatch.mock.calls
      .map(([action]) => action)
      .find(action => action.type === 'taskDrawer/setTaskFormViewModel');

    expect(seedAction.payload.task.status_id).toBe('legacy-status');
    expect(seedAction.payload.task.priority_id).toBe('legacy-priority');
    expect(seedAction.payload.phases).toEqual([]);
  });

  it('does nothing when the task id or project id is missing', () => {
    openReportingTaskDrawer(dispatch as never, buildTask({ id: '' }), PROJECT_ID);
    openReportingTaskDrawer(dispatch as never, buildTask(), '');

    expect(dispatch).not.toHaveBeenCalled();
  });
});
