import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ButtonState {
  isButtonDisable: boolean;
}

const initialState: ButtonState = {
  isButtonDisable: true,
};

const buttonSlice = createSlice({
  name: 'button',
  initialState,
  reducers: {
    setButtonDisabled: (state, action: PayloadAction<boolean>) => {
      state.isButtonDisable = action.payload;
    },
  },
});

export const { setButtonDisabled } = buttonSlice.actions;
export default buttonSlice.reducer;
