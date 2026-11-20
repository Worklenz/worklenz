import { describe, expect, it } from 'vitest';
import reducer, {
  updateTaskPriority,
  updateTaskStatus,
} from './all-tasks-reports-slice';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

const baseTask = {
  id: 'task-1',
  status_id: 'status-todo',
  status_name: 'To Do',
  status_color: '#a9a9a9',
  priority_id: 'priority-medium',
  priority_name: 'Medium',
  priority_color: '#DAA520',
} as IProjectTask;

const withTask = (task: IProjectTask) => {
  const initial = reducer(undefined, { type: 'unknown' });
  return {
    ...initial,
    tasksList: [task],
    groupedTasks: [
      { id: 'g1', name: 'Group', color: '#ccc', tasks: [task], isExpanded: true },
    ],
  };
};

describe('allTasksReportsSlice status/priority colors', () => {
  it('applies status updates with solid colors (strips socket alpha)', () => {
    const next = reducer(
      withTask({ ...baseTask }),
      updateTaskStatus({
        id: 'task-1',
        status_id: 'status-doing',
        status_name: 'Doing',
        color_code: '#70a6f369',
        color_code_dark: '#2684ff69',
      })
    );

    expect(next.tasksList[0].status_name).toBe('Doing');
    expect(next.tasksList[0].status_color).toBe('#70a6f3');
    expect(next.tasksList[0].status_color_dark).toBe('#2684ff');
    expect(next.groupedTasks[0].tasks[0].status_color).toBe('#70a6f3');
  });

  it('applies priority updates with solid colors (strips socket alpha)', () => {
    const next = reducer(
      withTask({ ...baseTask }),
      updateTaskPriority({
        id: 'task-1',
        priority_id: 'priority-critical',
        priority_name: 'Critical',
        color_code: '#8B1A1A69',
        color_code_dark: '#B2222269',
      })
    );

    expect(next.tasksList[0].priority_name).toBe('Critical');
    expect(next.tasksList[0].priority_color).toBe('#8B1A1A');
    expect(next.tasksList[0].priority_color_dark).toBe('#B22222');
    expect(next.groupedTasks[0].tasks[0].priority_color).toBe('#8B1A1A');
  });
});
