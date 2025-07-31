import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ProjectType } from '../../types/project.types';

type ProjectState = {
  projectsList: ProjectType[];
  isProjectModalOpen: boolean;
  isDrawerOpen: boolean;
  isUpdateDrawerOpen: boolean;
  drawerProjectId: string | null; // To store the project ID associated with the drawer
};

const saveProjectListToLocalStorage = (projectsList: ProjectType[]) => {
  try {
    const serializedList = JSON.stringify(projectsList);
    localStorage.setItem('projectList', serializedList);
  } catch (error) {
    console.error('Could not save project list', error);
  }
};

const getProjectListFromLocalStorage = (): ProjectType[] => {
  try {
    const serializedList = localStorage.getItem('projectList');
    if (serializedList === null) {
      return [];
    }
    return JSON.parse(serializedList);
  } catch (error) {
    console.error('Could not load project list', error);
    return [];
  }
};

const initialState: ProjectState = {
  projectsList: getProjectListFromLocalStorage(),
  isProjectModalOpen: false,
  isDrawerOpen: false,
  isUpdateDrawerOpen: false,
  drawerProjectId: null, // Initially, no project ID is selected
};

const projectSlice = createSlice({
  name: 'projectReducer',
  initialState,
  reducers: {
    toggleProjectModal: (state) => {
      state.isProjectModalOpen = !state.isProjectModalOpen;
    },
    toggleDrawer: (state) => {
      state.isDrawerOpen = !state.isDrawerOpen;
    },
    toggleUpdatedrawer: (state, action: PayloadAction<string | null>) => {
      state.isUpdateDrawerOpen = !state.isUpdateDrawerOpen;
      state.drawerProjectId = state.isDrawerOpen ? action.payload : null;
    },
    createProject: (state, action: PayloadAction<ProjectType>) => {
      state.projectsList.push(action.payload);
      saveProjectListToLocalStorage(state.projectsList);
    },
    toggleFavouriteProjectSelection: (state, action: PayloadAction<string>) => {
      const project = state.projectsList.find(
        (project) => project.projectId === action.payload
      );
      if (project) {
        project.isFavourite = !project.isFavourite;
      }
    },
    deleteProject: (state, action: PayloadAction<string>) => {
      state.projectsList = state.projectsList.filter(
        (project) => project.projectId !== action.payload
      );
      saveProjectListToLocalStorage(state.projectsList);
    },
    updateProject: (
      state,
      action: PayloadAction<{
        projectId: string;
        updatedData: Partial<ProjectType>;
      }>
    ) => {
      const { projectId, updatedData } = action.payload;
      const projectIndex = state.projectsList.findIndex(
        (project) => project.projectId === projectId
      );
      if (projectIndex !== -1) {
        state.projectsList[projectIndex] = {
          ...state.projectsList[projectIndex],
          ...updatedData,
        };
        saveProjectListToLocalStorage(state.projectsList);
      }
    },
  },
});

export const {
  toggleProjectModal,
  toggleDrawer,
  toggleUpdatedrawer,
  createProject,
  toggleFavouriteProjectSelection,
  deleteProject,
  updateProject,
} = projectSlice.actions;
export default projectSlice.reducer;
