import { createSlice } from '@reduxjs/toolkit';

interface taskTemplateState {
  isTaskTemplateDrawerOpen: boolean;
  selectedTemplate: string | null;
}

const initialState: taskTemplateState = {
  isTaskTemplateDrawerOpen: false,
  selectedTemplate: null,
};

const taskTemplateSlice = createSlice({
  name: 'taskTemplateReducer',
  initialState,
  reducers: {
    toggleTaskTemplateDrawer: state => {
      state.isTaskTemplateDrawerOpen
        ? (state.isTaskTemplateDrawerOpen = false)
        : (state.isTaskTemplateDrawerOpen = true);
    },
    setSelectedTemplate(state, action) {
      state.selectedTemplate = action.payload;
    },
  },
});

export const { toggleTaskTemplateDrawer, setSelectedTemplate } = taskTemplateSlice.actions;
export default taskTemplateSlice.reducer;
