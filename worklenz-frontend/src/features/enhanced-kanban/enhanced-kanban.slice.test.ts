import { describe, expect, it } from 'vitest';
import enhancedKanbanReducer, {
  fetchEnhancedKanbanGroups,
  IGroupBy,
  initKanbanGroupingFromServer,
} from './enhanced-kanban.slice';
import { ITaskListGroup } from '@/types/tasks/taskList.types';

describe('enhancedKanbanSlice', () => {
  it('ignores a recovery fetch that fulfills after switching projects', () => {
    const projectAGroup = {
      id: 'a-group',
      name: 'Project A',
      color_code: '',
      color_code_dark: '',
      tasks: [],
    } satisfies ITaskListGroup;
    const projectBGroup = {
      id: 'b-group',
      name: 'Project B',
      color_code: '',
      color_code_dark: '',
      tasks: [],
    } satisfies ITaskListGroup;

    let state = enhancedKanbanReducer(
      undefined,
      initKanbanGroupingFromServer({ groupBy: IGroupBy.STATUS, projectId: 'project-a' })
    );
    state = enhancedKanbanReducer(
      state,
      fetchEnhancedKanbanGroups.pending('recovery-a', 'project-a')
    );

    state = enhancedKanbanReducer(
      state,
      initKanbanGroupingFromServer({ groupBy: IGroupBy.STATUS, projectId: 'project-b' })
    );
    state = enhancedKanbanReducer(
      state,
      fetchEnhancedKanbanGroups.pending('load-b', 'project-b')
    );
    state = enhancedKanbanReducer(
      state,
      fetchEnhancedKanbanGroups.fulfilled([projectBGroup], 'load-b', 'project-b')
    );

    state = enhancedKanbanReducer(
      state,
      fetchEnhancedKanbanGroups.fulfilled([projectAGroup], 'recovery-a', 'project-a')
    );

    expect(state.taskGroups).toEqual([projectBGroup]);
    expect(state.loadedProjectId).toBe('project-b');
    expect(state.loadingGroups).toBe(false);
  });
});