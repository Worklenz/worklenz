import { createAsyncThunk, createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AppDispatch, RootState } from '@/app/store';
import projectSavedViewsApiService from '@/api/projects/project-saved-views.api.service';
import {
  IProjectSavedView,
  ISavedViewConfig,
  IUpdateSavedViewBody,
} from '@/types/project/project-saved-views.types';
import {
  fetchLabelsByProject,
  fetchTaskAssignees,
  setLabels,
  setMembers,
  setPhases,
  setPriorities,
  setSavedViewActive,
  setSearch as setTasksSearch,
  setStatuses,
} from '@/features/tasks/tasks.slice';
import {
  fetchTasksV3,
  setArchived as setTaskManagementArchived,
  setSearch as setTaskManagementSearch,
  setSort,
} from '@/features/task-management/task-management.slice';
import { isGroupingType, setCurrentGrouping } from '@/features/task-management/grouping.slice';
import { areSavedViewConfigsEqual, serializeSavedViewConfig } from './saved-view-config';

interface SavedViewsState {
  projectId: string | null;
  views: IProjectSavedView[];
  loading: boolean;
  loaded: boolean;
  /** The saved view whose config is currently applied to the Task List. */
  activeViewId: string | null;
  /** The List tab's state from before a saved view was opened, restored when leaving it. */
  baseSnapshot: ISavedViewConfig | null;
  /** A just-created tab whose name is being edited inline. */
  renamingViewId: string | null;
}

const initialState: SavedViewsState = {
  projectId: null,
  views: [],
  loading: false,
  loaded: false,
  activeViewId: null,
  baseSnapshot: null,
  renamingViewId: null,
};

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export const fetchSavedViews = createAsyncThunk(
  'savedViews/fetch',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const response = await projectSavedViewsApiService.list(projectId);
      if (!response.done) return rejectWithValue(response.message);
      return response.body;
    } catch (error) {
      return rejectWithValue(errorMessage(error, 'Failed to load saved views'));
    }
  }
);

export const createSavedView = createAsyncThunk<
  IProjectSavedView,
  { projectId: string; name: string },
  { state: RootState; rejectValue: string }
>('savedViews/create', async ({ projectId, name }, { getState, rejectWithValue }) => {
  try {
    const response = await projectSavedViewsApiService.create(projectId, {
      name,
      base_view: 'tasks-list',
      config: serializeSavedViewConfig(getState()),
    });
    if (!response.done) return rejectWithValue(response.message || 'Failed to save view');
    return response.body;
  } catch (error) {
    return rejectWithValue(errorMessage(error, 'Failed to save view'));
  }
});

export const updateSavedView = createAsyncThunk<
  IProjectSavedView,
  { projectId: string; viewId: string; body: IUpdateSavedViewBody },
  { rejectValue: string }
>('savedViews/update', async ({ projectId, viewId, body }, { rejectWithValue }) => {
  try {
    const response = await projectSavedViewsApiService.update(projectId, viewId, body);
    if (!response.done) return rejectWithValue(response.message || 'Failed to update view');
    return response.body;
  } catch (error) {
    return rejectWithValue(errorMessage(error, 'Failed to update view'));
  }
});

/** Overwrites the active saved view with what is currently on screen. */
export const saveActiveSavedView = createAsyncThunk<
  IProjectSavedView,
  { projectId: string },
  { state: RootState; dispatch: AppDispatch; rejectValue: string }
>('savedViews/saveActive', async ({ projectId }, { getState, dispatch, rejectWithValue }) => {
  const viewId = getState().savedViewsReducer.activeViewId;
  if (!viewId) return rejectWithValue('No saved view is open');
  const result = await dispatch(
    updateSavedView({ projectId, viewId, body: { config: serializeSavedViewConfig(getState()) } })
  );
  if (updateSavedView.rejected.match(result)) {
    return rejectWithValue(result.payload || 'Failed to update view');
  }
  return result.payload;
});

export const deleteSavedView = createAsyncThunk<
  string,
  { projectId: string; viewId: string },
  { rejectValue: string }
>('savedViews/delete', async ({ projectId, viewId }, { rejectWithValue }) => {
  try {
    const response = await projectSavedViewsApiService.delete(projectId, viewId);
    if (!response.done) return rejectWithValue(response.message || 'Failed to delete view');
    return viewId;
  } catch (error) {
    return rejectWithValue(errorMessage(error, 'Failed to delete view'));
  }
});

/**
 * Puts a saved view's config into the same Redux state the filter toolbar edits. Ids that no
 * longer exist in the project (deleted statuses, removed members...) are dropped silently.
 */
const applyConfigToTaskList = (
  dispatch: AppDispatch,
  state: RootState,
  config: ISavedViewConfig
): void => {
  const allStatuses = state.taskStatusReducer?.status || [];
  dispatch(
    setStatuses(
      allStatuses
        .filter(status => !!status.id && config.statuses.includes(status.id))
        .map(status => ({ id: status.id, name: status.name, color_code: status.color_code }))
    )
  );
  dispatch(setPriorities(config.priorities));
  dispatch(setPhases(config.phases));
  dispatch(
    setMembers(
      state.taskReducer.taskAssignees.map(member => ({
        ...member,
        selected: !!member.id && config.members.includes(member.id),
      }))
    )
  );
  dispatch(
    setLabels(
      state.taskReducer.labels.map(label => ({
        ...label,
        selected: !!label.id && config.labels.includes(label.id),
      }))
    )
  );
  dispatch(setTaskManagementSearch(config.search));
  dispatch(setTasksSearch(config.search));
  dispatch(setTaskManagementArchived(config.archived));
  dispatch(setSort({ field: config.sort_field, order: config.sort_order }));
  if (isGroupingType(config.group)) dispatch(setCurrentGrouping(config.group));
};

/** Member and label selections can only be applied once their option lists are loaded. */
const ensureFilterOptionsLoaded = async (
  dispatch: AppDispatch,
  getState: () => RootState,
  projectId: string,
  config: ISavedViewConfig
): Promise<void> => {
  const { taskAssignees, labels } = getState().taskReducer;
  await Promise.all([
    config.members.length && !taskAssignees.length
      ? dispatch(fetchTaskAssignees(projectId))
      : Promise.resolve(),
    config.labels.length && !labels.length
      ? dispatch(fetchLabelsByProject(projectId))
      : Promise.resolve(),
  ]);
};

export const enterSavedView = createAsyncThunk<
  void,
  { projectId: string; viewId: string },
  { state: RootState; dispatch: AppDispatch }
>('savedViews/enter', async ({ projectId, viewId }, { getState, dispatch }) => {
  const state = getState();
  const view = state.savedViewsReducer.views.find(item => item.id === viewId);
  if (!view) return;

  // Mark the view active before awaiting anything so a re-render cannot enter it twice.
  if (!state.savedViewsReducer.activeViewId) {
    dispatch(savedViewsSlice.actions.setBaseSnapshot(serializeSavedViewConfig(state)));
  }
  dispatch(savedViewsSlice.actions.setActiveViewId(viewId));
  dispatch(setSavedViewActive(true));

  await ensureFilterOptionsLoaded(dispatch, getState, projectId, view.config);
  if (getState().savedViewsReducer.activeViewId !== viewId) return;

  if (areSavedViewConfigsEqual(serializeSavedViewConfig(getState()), view.config)) return;
  applyConfigToTaskList(dispatch, getState(), view.config);
  await dispatch(fetchTasksV3(projectId));
});

/** Leaves the open saved view and puts the List tab's own filters back. */
export const exitSavedView = createAsyncThunk<
  void,
  { projectId: string; refetch: boolean },
  { state: RootState; dispatch: AppDispatch }
>('savedViews/exit', async ({ projectId, refetch }, { getState, dispatch }) => {
  const { activeViewId, baseSnapshot } = getState().savedViewsReducer;
  if (!activeViewId) return;

  if (baseSnapshot) applyConfigToTaskList(dispatch, getState(), baseSnapshot);
  dispatch(savedViewsSlice.actions.clearActiveView());
  dispatch(setSavedViewActive(false));
  if (refetch) await dispatch(fetchTasksV3(projectId));
});

export const revertSavedView = createAsyncThunk<
  void,
  { projectId: string },
  { state: RootState; dispatch: AppDispatch }
>('savedViews/revert', async ({ projectId }, { getState, dispatch }) => {
  const { activeViewId, views } = getState().savedViewsReducer;
  const view = views.find(item => item.id === activeViewId);
  if (!view) return;
  applyConfigToTaskList(dispatch, getState(), view.config);
  await dispatch(fetchTasksV3(projectId));
});

const savedViewsSlice = createSlice({
  name: 'savedViews',
  initialState,
  reducers: {
    resetSavedViews: () => initialState,
    setActiveViewId: (state, action: PayloadAction<string>) => {
      state.activeViewId = action.payload;
    },
    setBaseSnapshot: (state, action: PayloadAction<ISavedViewConfig>) => {
      state.baseSnapshot = action.payload;
    },
    clearActiveView: state => {
      state.activeViewId = null;
      state.baseSnapshot = null;
    },
    setRenamingViewId: (state, action: PayloadAction<string | null>) => {
      state.renamingViewId = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchSavedViews.pending, (state, action) => {
        if (state.projectId !== action.meta.arg) {
          state.views = [];
          state.loaded = false;
        }
        state.projectId = action.meta.arg;
        state.loading = true;
      })
      .addCase(fetchSavedViews.fulfilled, (state, action) => {
        if (state.projectId !== action.meta.arg) return;
        state.views = action.payload;
        state.loading = false;
        state.loaded = true;
      })
      .addCase(fetchSavedViews.rejected, (state, action) => {
        if (state.projectId !== action.meta.arg) return;
        state.loading = false;
        state.loaded = true;
      })
      .addCase(createSavedView.fulfilled, (state, action) => {
        if (state.projectId !== action.meta.arg.projectId) return;
        state.views.push(action.payload);
        state.renamingViewId = action.payload.id;
      })
      .addCase(updateSavedView.fulfilled, (state, action) => {
        const index = state.views.findIndex(view => view.id === action.payload.id);
        if (index !== -1) state.views[index] = action.payload;
      })
      .addCase(deleteSavedView.fulfilled, (state, action) => {
        state.views = state.views.filter(view => view.id !== action.payload);
        if (state.renamingViewId === action.payload) state.renamingViewId = null;
      });
  },
});

export const { resetSavedViews, setRenamingViewId } = savedViewsSlice.actions;

export const selectSavedViews = (state: RootState) => state.savedViewsReducer.views;
export const selectActiveSavedView = (state: RootState): IProjectSavedView | null => {
  const { activeViewId, views } = state.savedViewsReducer;
  return views.find(view => view.id === activeViewId) ?? null;
};

/** What the Task List toolbar currently shows, in saved view form. */
export const selectCurrentSavedViewConfig = createSelector(
  [
    (state: RootState) => state.taskReducer.priorities,
    (state: RootState) => state.taskReducer.phases,
    (state: RootState) => state.taskReducer.statuses,
    (state: RootState) => state.taskReducer.taskAssignees,
    (state: RootState) => state.taskReducer.labels,
    (state: RootState) => state.taskManagement.search,
    (state: RootState) => state.taskManagement.archived,
    (state: RootState) => state.taskManagement.sortField,
    (state: RootState) => state.taskManagement.sortOrder,
    (state: RootState) => state.grouping.currentGrouping,
  ],
  (
    priorities,
    phases,
    statuses,
    taskAssignees,
    labels,
    search,
    archived,
    sortField,
    sortOrder,
    currentGrouping
  ) =>
    serializeSavedViewConfig({
      taskReducer: { priorities, phases, statuses, taskAssignees, labels },
      taskManagement: { search, archived, sortField, sortOrder },
      grouping: { currentGrouping },
    })
);

export default savedViewsSlice.reducer;
