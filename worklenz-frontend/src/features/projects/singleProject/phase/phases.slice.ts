import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { phasesApiService } from '@/api/taskAttributes/phases/phases.api.service';

type PhaseState = {
  isPhaseDrawerOpen: boolean;
  phaseList: ITaskPhase[];
  loadingPhases: boolean;
};

const initialState: PhaseState = {
  isPhaseDrawerOpen: false,
  phaseList: [],
  loadingPhases: false,
};

export const addPhaseOption = createAsyncThunk(
  'phase/addPhaseOption',
  async ({ projectId, name }: { projectId: string; name?: string }, { rejectWithValue }) => {
    try {
      const response = await phasesApiService.addPhaseOption(projectId, name);
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const fetchPhasesByProjectId = createAsyncThunk(
  'phase/fetchPhasesByProjectId',
  async (projectId: string, { rejectWithValue }) => {
    try {
      const response = await phasesApiService.getPhasesByProjectId(projectId);
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const deletePhaseOption = createAsyncThunk(
  'phase/deletePhaseOption',
  async (
    { phaseOptionId, projectId }: { phaseOptionId: string; projectId: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await phasesApiService.deletePhaseOption(phaseOptionId, projectId);
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const updatePhaseColor = createAsyncThunk(
  'phase/updatePhaseColor',
  async ({ projectId, body }: { projectId: string; body: ITaskPhase }, { rejectWithValue }) => {
    try {
      const response = await phasesApiService.updatePhaseColor(projectId, body);
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const updatePhaseOrder = createAsyncThunk(
  'phases/updatePhaseOrder',
  async ({
    projectId,
    body,
  }: {
    projectId: string;
    body: {
      from_index: number;
      to_index: number;
      phases: ITaskPhase[];
      project_id: string;
    };
  }) => {
    try {
      const response = await phasesApiService.updatePhaseOrder(projectId, body);
      return response;
    } catch (error) {
      throw error;
    }
  }
);

export const updateProjectPhaseLabel = createAsyncThunk(
  'phase/updateProjectPhaseLabel',
  async (
    { projectId, phaseLabel }: { projectId: string; phaseLabel: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await phasesApiService.updateProjectPhaseLabel(projectId, phaseLabel);
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const updatePhaseName = createAsyncThunk(
  'phase/updatePhaseName',
  async (
    { phaseId, phase, projectId }: { phaseId: string; phase: ITaskPhase; projectId: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await phasesApiService.updateNameOfPhase(phaseId, phase, projectId);
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const updatePhaseDates = createAsyncThunk(
  'phase/updatePhaseDates',
  async (
    {
      phase,
      projectId,
      start_date,
      end_date,
    }: {
      phase: ITaskPhase;
      projectId: string;
      start_date: string | null;
      end_date: string | null;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await phasesApiService.updateNameOfPhase(
        phase.id,
        { ...phase, start_date, end_date },
        projectId
      );
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export interface SprintDetailsUpdate {
  name: string;
  sprint_goal: string | null;
  start_date: string | null;
  end_date: string | null;
}

export const updateSprintDetails = createAsyncThunk(
  'phase/updateSprintDetails',
  async (
    { phase, projectId, details }: { phase: ITaskPhase; projectId: string; details: SprintDetailsUpdate },
    { rejectWithValue }
  ) => {
    try {
      const response = await phasesApiService.updateNameOfPhase(
        phase.id,
        { ...phase, ...details },
        projectId
      );
      if (!response.done) return rejectWithValue(response);
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const updatePhaseDefaultAssignee = createAsyncThunk(
  'phase/updatePhaseDefaultAssignee',
  async (
    {
      phaseId,
      projectId,
      defaultAssigneeId,
    }: { phaseId: string; projectId: string; defaultAssigneeId: string | null },
    { rejectWithValue }
  ) => {
    try {
      const response = await phasesApiService.updateDefaultAssignee(
        phaseId,
        projectId,
        defaultAssigneeId
      );
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const startSprint = createAsyncThunk(
  'phase/startSprint',
  async (
    { phaseId, projectId }: { phaseId: string; projectId: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await phasesApiService.startSprint(phaseId, projectId);
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const completeSprint = createAsyncThunk(
  'phase/completeSprint',
  async (
    {
      phaseId,
      projectId,
      destinationPhaseId,
    }: { phaseId: string; projectId: string; destinationPhaseId?: string | null },
    { rejectWithValue }
  ) => {
    try {
      const response = await phasesApiService.completeSprint(
        phaseId,
        projectId,
        destinationPhaseId ?? null
      );
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);

export const addPhaseWithDates = createAsyncThunk(
  'phase/addPhaseWithDates',
  async (
    {
      projectId,
      name,
      start_date,
      end_date,
    }: {
      projectId: string;
      name: string;
      start_date?: string | null;
      end_date?: string | null;
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await phasesApiService.addPhaseOptionWithDates(projectId, {
        name,
        start_date,
        end_date,
      });
      return response;
    } catch (error) {
      return rejectWithValue(error);
    }
  }
);
const phaseSlice = createSlice({
  name: 'phaseReducer',
  initialState,
  reducers: {
    toggleDrawer: state => {
      state.isPhaseDrawerOpen = !state.isPhaseDrawerOpen;
    },
    updatePhaseListOrder: (state, action: PayloadAction<ITaskPhase[]>) => {
      state.phaseList = action.payload;
    },
  },
  extraReducers: builder => {
    builder.addCase(fetchPhasesByProjectId.fulfilled, (state, action) => {
      state.phaseList = (action.payload.body || []).map((phase: ITaskPhase) => ({
        ...phase,
        color_code: phase.color_code?.length === 9
          ? phase.color_code.slice(0, 7)
          : phase.color_code,
      }));
      state.loadingPhases = false;
    });
    builder.addCase(fetchPhasesByProjectId.pending, state => {
      state.loadingPhases = true;
    });
    builder.addCase(fetchPhasesByProjectId.rejected, state => {
      state.loadingPhases = false;
    });
    builder.addCase(updatePhaseDefaultAssignee.fulfilled, (state, action) => {
      if (action.payload?.body) {
        const updated = action.payload.body;
        const idx = state.phaseList.findIndex(p => p.id === updated.id);
        if (idx !== -1) {
          state.phaseList[idx] = {
            ...state.phaseList[idx],
            default_assignee_id: updated.default_assignee_id,
            default_assignee_name: updated.default_assignee_name,
            default_assignee_avatar_url: updated.default_assignee_avatar_url,
          };
        }
      }
    });

    // Optimistic updates — patch only the affected item so the popup never remounts.
    builder.addCase(addPhaseOption.fulfilled, (state, action) => {
      if (action.payload?.body) {
        const newPhase = action.payload.body;
        state.phaseList.push({
          ...newPhase,
          color_code:
            newPhase.color_code?.length === 9
              ? newPhase.color_code.slice(0, 7)
              : newPhase.color_code,
        });
      }
    });

    builder.addCase(addPhaseWithDates.fulfilled, (state, action) => {
      if (action.payload?.body) {
        const newPhase = action.payload.body;
        state.phaseList.unshift({
          ...newPhase,
          color_code:
            newPhase.color_code?.length === 9
              ? newPhase.color_code.slice(0, 7)
              : newPhase.color_code,
        });
      }
    });

    builder.addCase(startSprint.fulfilled, (state, action) => {
      if (action.payload?.body) {
        const updated = action.payload.body;
        state.phaseList = state.phaseList.map(p =>
          p.id === updated.id
            ? {
                ...p,
                ...updated,
                color_code:
                  updated.color_code?.length === 9
                    ? updated.color_code.slice(0, 7)
                    : updated.color_code,
              }
            : p.sprint_status === 'active'
              ? { ...p, sprint_status: 'planned' as const }
              : p
        );
      }
    });

    builder.addCase(completeSprint.fulfilled, (state, action) => {
      if (action.payload?.body) {
        const updated = action.payload.body;
        const idx = state.phaseList.findIndex(p => p.id === updated.id);
        if (idx !== -1) {
          state.phaseList[idx] = {
            ...state.phaseList[idx],
            ...updated,
            color_code:
              updated.color_code?.length === 9
                ? updated.color_code.slice(0, 7)
                : updated.color_code,
          };
        }
      }
    });

    builder.addCase(updatePhaseColor.fulfilled, (state, action) => {
      if (action.payload?.body) {
        const updated = action.payload.body;
        const idx = state.phaseList.findIndex(p => p.id === updated.id);
        if (idx !== -1) {
          state.phaseList[idx] = {
            ...state.phaseList[idx],
            color_code:
              updated.color_code?.length === 9
                ? updated.color_code.slice(0, 7)
                : updated.color_code,
          };
        }
      }
    });

    builder.addCase(updatePhaseName.fulfilled, (state, action) => {
      if (action.payload?.body) {
        const updated = action.payload.body;
        const idx = state.phaseList.findIndex(p => p.id === updated.id);
        if (idx !== -1) {
          state.phaseList[idx] = { ...state.phaseList[idx], name: updated.name };
        }
      }
    });

    builder.addCase(updatePhaseDates.fulfilled, (state, action) => {
      if (action.payload?.body) {
        const updated = action.payload.body;
        const idx = state.phaseList.findIndex(p => p.id === updated.id);
        if (idx !== -1) {
          state.phaseList[idx] = {
            ...state.phaseList[idx],
            start_date: updated.start_date,
            end_date: updated.end_date,
          };
        }
      }
    });

    builder.addCase(updateSprintDetails.fulfilled, (state, action) => {
      const updated = action.payload?.body;
      if (!updated) return;
      const idx = state.phaseList.findIndex(p => p.id === updated.id);
      if (idx !== -1) {
        state.phaseList[idx] = {
          ...state.phaseList[idx],
          name: updated.name,
          sprint_goal: updated.sprint_goal ?? null,
          start_date: updated.start_date,
          end_date: updated.end_date,
        };
      }
    });

    builder.addCase(deletePhaseOption.fulfilled, (state, action) => {
      // Backend returns RETURNING id, so body is { id } of the deleted phase.
      if (action.payload?.body?.id) {
        state.phaseList = state.phaseList.filter(p => p.id !== action.payload.body.id);
      }
    });
  },
});

export const { toggleDrawer, updatePhaseListOrder } = phaseSlice.actions;
export default phaseSlice.reducer;
