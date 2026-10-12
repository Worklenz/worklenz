import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ILocalSession } from '@/types/auth/local-session.types';
import { getUserSession } from '@/utils/session-helper';

const sessionData = getUserSession();

const initialState: ILocalSession = {
  id: sessionData?.id || '',
  name: sessionData?.name || '',
  email: sessionData?.email || '',
  avatar_url: sessionData?.avatar_url || '',
  is_guest: sessionData?.is_guest === true,
  owner: sessionData?.owner === true,
  is_admin: sessionData?.is_admin === true,
  role_name: sessionData?.role_name,
};

const userSlice = createSlice({
  name: 'userReducer',
  initialState,
  reducers: {
    changeUserName: (state, action: PayloadAction<string>) => {
      state.name = action.payload;
    },
    setUser: (state, action: PayloadAction<ILocalSession>) => {
      // Keep Redux user state aligned with the authenticated session so
      // guest/role UI (profile label, etc.) does not fall back to Member.
      Object.assign(state, action.payload);
    },
  },
});

export const { changeUserName, setUser } = userSlice.actions;
export default userSlice.reducer;
