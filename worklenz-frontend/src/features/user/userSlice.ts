import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ILocalSession } from '@/types/auth/local-session.types';
import { getUserSession } from '@/utils/session-helper';

const sessionData = getUserSession();

const initialState: ILocalSession = {
  id: sessionData?.id || '',
  name: sessionData?.name || '',
  email: sessionData?.email || '',
  avatar_url: sessionData?.avatar_url || '',
};

const userSlice = createSlice({
  name: 'userReducer',
  initialState,
  reducers: {
    changeUserName: (state, action: PayloadAction<string>) => {
      state.name = action.payload;
    },
    setUser: (state, action: PayloadAction<ILocalSession>) => {
      // Update state properties individually to ensure mutation
      state.id = action.payload.id;
      state.name = action.payload.name;
      state.email = action.payload.email;
      state.avatar_url = action.payload.avatar_url;
      // Add other properties as needed
    },
  },
});

export const { changeUserName, setUser } = userSlice.actions;
export default userSlice.reducer;
