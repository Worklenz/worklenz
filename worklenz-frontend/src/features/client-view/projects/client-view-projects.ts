import { createSlice } from '@reduxjs/toolkit';

type TempProjectType = {
  id: string;
  name: string;
  status: string;
  totalTasks: number;
  completedTasks: number;
  lastUpdated: Date;
  members: string[];
};

const tempProjectsList: TempProjectType[] = [
  {
    id: '1',
    name: 'Project 1',
    status: 'Proposed',
    totalTasks: 10,
    completedTasks: 5,
    lastUpdated: new Date('2024-10-08T08:30:00'),
    members: ['Chathuranga Pathum', 'Chamika Jayasri', 'Raveesha Dilanka', 'Sachintha Prasad'],
  },
];

type ProjectsState = {
  projectsList: TempProjectType[];
};

const initialState: ProjectsState = {
  projectsList: tempProjectsList,
};

const clientViewProjects = createSlice({
  name: 'projectsReducer',
  initialState,
  reducers: {},
});

export default clientViewProjects.reducer;
