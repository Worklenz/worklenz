import { createSlice } from '@reduxjs/toolkit';

interface priority {
  id: string;
  name: string;
  category: string;
}

interface priorityState {
  priority: priority[];
}

const initialState: priorityState = {
  priority: [
    {
      id: '1',
      name: 'Low',
      category: 'low',
    },
    {
      id: '2',
      name: 'Medium',
      category: 'medium',
    },
    {
      id: '3',
      name: 'High',
      category: 'high',
    },
  ],
};

const prioritySlice = createSlice({
  name: 'priorityReducer',
  initialState,
  reducers: {
    addPriority: (state, action) => {
      state.priority.push(action.payload);
    },
    updatePriorityCategory: (state, action) => {
      const priority = state.priority.find(priority => priority.id === action.payload.id);
      if (priority) {
        priority.category = action.payload.category;
      }
    },
    deletePriority: (state, action) => {
      state.priority = state.priority.filter(priority => priority.id !== action.payload);
    },
  },
});

export const { addPriority, updatePriorityCategory, deletePriority } = prioritySlice.actions;
export default prioritySlice.reducer;
