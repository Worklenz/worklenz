import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITaskListColumn, ITaskListGroup } from '@/types/tasks/taskList.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';
import { ITaskPrioritiesGetResponse } from '@/types/apiModels/taskPrioritiesGetResponse.types';
import { ITaskStatusViewModel } from '@/types/tasks/taskStatusGetResponse.types';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { IProjectViewModel } from '@/types/project/projectViewModel.types';
import { projectsApiService } from '@/api/projects/projects.api.service';

interface TaskListState {
  projectId: string | null;
  project: IProjectViewModel | null;
  projectLoading: boolean;
  columns: ITaskListColumn[];
  members: ITeamMemberViewModel[];
  activeMembers: [];
  labels: ITaskLabel[];
  statuses: ITaskStatusViewModel[];
  priorities: ITaskPrioritiesGetResponse[];
  phases: ITaskPhase[];
  groups: ITaskListGroup[];
  isSubtasksIncluded: boolean;
  selectedTasks: IProjectTask[];
  isLoading: boolean;
  error: string | null;
  importTaskTemplateDrawerOpen: boolean;
  createTaskTemplateDrawerOpen: boolean;
  projectView: 'list' | 'kanban';
  refreshTimestamp: string | null;
}

const initialState: TaskListState = {
  projectId: null,
  project: null,
  projectLoading: false,
  activeMembers: [],
  columns: [],
  members: [],
  labels: [],
  statuses: [],
  priorities: [],
  phases: [],
  groups: [],
  isSubtasksIncluded: false,
  selectedTasks: [],
  isLoading: false,
  error: null,
  importTaskTemplateDrawerOpen: false,
  createTaskTemplateDrawerOpen: false,
  projectView: 'list',
  refreshTimestamp: null,
};

export const getProject = createAsyncThunk(
  'project/getProject',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const response = await projectsApiService.getProject(projectId);
      return response.body;
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to fetch project');
    }
  }
);

const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    setProjectId: (state, action: PayloadAction<string | null>) => {
      state.projectId = action.payload;
    },
    setProject: (state, action: PayloadAction<IProjectViewModel>) => {
      state.project = action.payload;
    },
    setColumns: (state, action: PayloadAction<ITaskListColumn[]>) => {
      state.columns = action.payload;
    },
    setMembers: (state, action: PayloadAction<ITeamMemberViewModel[]>) => {
      state.members = action.payload;
    },
    setLabels: (state, action: PayloadAction<ITaskLabel[]>) => {
      state.labels = action.payload;
    },
    setStatuses: (state, action: PayloadAction<ITaskStatusViewModel[]>) => {
      state.statuses = action.payload;
    },
    setPriorities: (state, action: PayloadAction<ITaskPrioritiesGetResponse[]>) => {
      state.priorities = action.payload;
    },
    setPhases: (state, action: PayloadAction<ITaskPhase[]>) => {
      state.phases = action.payload;
    },
    setGroups: (state, action: PayloadAction<ITaskListGroup[]>) => {
      state.groups = action.payload;
    },
    setSubtasksIncluded: (state, action: PayloadAction<boolean>) => {
      state.isSubtasksIncluded = action.payload;
    },
    setSelectedTasks: (state, action: PayloadAction<IProjectTask[]>) => {
      state.selectedTasks = action.payload;
    },
    setActiveMembers: (state, action: PayloadAction<[]>) => {
      state.activeMembers = action.payload;
    },
    setImportTaskTemplateDrawerOpen: (state, action: PayloadAction<boolean>) => {
      state.importTaskTemplateDrawerOpen = action.payload;
    },
    setCreateTaskTemplateDrawerOpen: (state, action: PayloadAction<boolean>) => {
      state.createTaskTemplateDrawerOpen = action.payload;
    },
    updatePhaseLabel: (state, action: PayloadAction<string>) => {
      if (state.project) {
        state.project.phase_label = action.payload;
      }
    },
    updateProjectCurrency: (state, action: PayloadAction<string>) => {
      if (state.project) {
        state.project.currency = action.payload;
      }
    },
    addTask: (
      state,
      action: PayloadAction<{ task: IProjectTask; groupId: string; insert?: boolean }>
    ) => {
      const { task, groupId, insert = false } = action.payload;
      const group = state.groups.find(g => g.id === groupId);

      if (!group || !task.id) return;

      if (task.parent_task_id) {
        const parentTask = group.tasks.find(t => t.id === task.parent_task_id);
        if (parentTask) {
          parentTask.sub_tasks_count = (parentTask.sub_tasks_count || 0) + 1;
          if (!parentTask.sub_tasks) parentTask.sub_tasks = [];
          parentTask.sub_tasks.push(task);

          // Add subtask to the main tasks array if subtasks are included
          if (state.isSubtasksIncluded) {
            const parentIndex = group.tasks.indexOf(parentTask);
            if (parentIndex !== -1) {
              group.tasks.splice(parentIndex + 1, 0, task);
            }
          }
        }
      } else {
        insert ? group.tasks.unshift(task) : group.tasks.push(task);
      }
    },
    deleteTask: (state, action: PayloadAction<{ taskId: string; index?: number }>) => {
      const { taskId, index } = action.payload;

      for (const group of state.groups) {
        const taskIndex = index ?? group.tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) continue;

        const task = group.tasks[taskIndex];

        if (task.is_sub_task) {
          const parentTask = group.tasks.find(t => t.id === task.parent_task_id);
          if (parentTask?.sub_tasks) {
            const subTaskIndex = parentTask.sub_tasks.findIndex(t => t.id === task.id);
            if (subTaskIndex !== -1) {
              parentTask.sub_tasks_count = Math.max((parentTask.sub_tasks_count || 0) - 1, 0);
              parentTask.sub_tasks.splice(subTaskIndex, 1);
            }
          }
        } else {
          group.tasks.splice(taskIndex, 1);
        }
        break;
      }
    },
    reset: () => initialState,
    setRefreshTimestamp: state => {
      state.refreshTimestamp = new Date().getTime().toString();
    },
    setProjectView: (state, action: PayloadAction<'list' | 'kanban'>) => {
      state.projectView = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(getProject.pending, state => {
        state.projectLoading = true;
        state.error = null;
      })
      .addCase(getProject.fulfilled, (state, action) => {
        state.projectLoading = false;
        state.project = action.payload;
      })
      .addCase(getProject.rejected, (state, action) => {
        state.projectLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  setProjectId,
  setProject,
  setColumns,
  setMembers,
  setLabels,
  setStatuses,
  setPriorities,
  setPhases,
  setGroups,
  setSubtasksIncluded,
  setSelectedTasks,
  setActiveMembers,
  addTask,
  deleteTask,
  reset,
  setImportTaskTemplateDrawerOpen,
  setCreateTaskTemplateDrawerOpen,
  setProjectView,
  updatePhaseLabel,
  setRefreshTimestamp,
  updateProjectCurrency,
} = projectSlice.actions;

export default projectSlice.reducer;
