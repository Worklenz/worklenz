import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface ITeamMember {
  id?: string;
  name?: string;
  job_title_id?: string;
  is_owner?: boolean;
  user_id?: string;
  team_id?: string;
  pending_invitation?: boolean;
  role_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ITeamMemberViewModel extends ITeamMember {
  id?: string;
  active?: boolean;
  name?: string;
  taskCount?: number;
  job_title?: string;
  email?: string;
  task_count?: number;
  projects_count?: number;
  role_name?: string;
  tasks?: any[]; // ITask[] type would need to be imported
  is_admin?: boolean;
  show_handles?: boolean;
  is_online?: boolean;
  avatar_url?: string;
  selected?: boolean;
  color_code?: string;
  usage?: number;
  projects?: any;
  total_logged_time?: string;
  member_teams?: string[];
  is_pending?: boolean;
}

interface TaskMemberState {
  assignees: ITeamMemberViewModel[];
  loading: boolean;
  error: string | null;
}

const initialState: TaskMemberState = {
  assignees: [],
  loading: false,
  error: null,
};

export const fetchTaskAssignees = createAsyncThunk(
  'taskMember/fetchTaskAssignees',
  async (projectId: string) => {
    const response = await fetch(`/api/tasks/assignees/${projectId}`);
    const data = await response.json();
    return data.data;
  }
);

const taskMemberSlice = createSlice({
  name: 'taskMember',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchTaskAssignees.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchTaskAssignees.fulfilled,
        (state, action: PayloadAction<ITeamMemberViewModel[]>) => {
          state.loading = false;
          state.assignees = action.payload;
        }
      )
      .addCase(fetchTaskAssignees.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch assignees';
      });
  },
});

export default taskMemberSlice.reducer;
