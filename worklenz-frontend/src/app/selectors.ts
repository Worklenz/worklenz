import { createSelector } from '@reduxjs/toolkit';
import { RootState } from './store';

// Memoized selectors for better performance
// These prevent unnecessary re-renders when state hasn't actually changed

// Auth selectors
export const selectAuth = (state: RootState) => state.auth;
export const selectUser = (state: RootState) => state.userReducer;
export const selectIsAuthenticated = createSelector([selectAuth], auth => !!auth.user);

// Project selectors
export const selectProjects = (state: RootState) => state.projectsReducer;
export const selectCurrentProject = (state: RootState) => state.projectReducer;
export const selectProjectMembers = (state: RootState) => state.projectMemberReducer;

// Task selectors
export const selectTasks = (state: RootState) => state.taskReducer;
export const selectTaskManagement = (state: RootState) => state.taskManagement;
export const selectTaskSelection = (state: RootState) => state.taskManagementSelection;

// UI State selectors
export const selectTheme = (state: RootState) => state.themeReducer;
export const selectLocale = (state: RootState) => state.localesReducer;
export const selectAlerts = (state: RootState) => state.alertsReducer;

// Board and Project View selectors
export const selectBoard = (state: RootState) => state.boardReducer;
export const selectProjectView = (state: RootState) => state.projectViewReducer;
export const selectProjectDrawer = (state: RootState) => state.projectDrawerReducer;

// Task attributes selectors
export const selectTaskPriorities = (state: RootState) => state.priorityReducer;
export const selectTaskLabels = (state: RootState) => state.taskLabelsReducer;
export const selectTaskStatuses = (state: RootState) => state.taskStatusReducer;
export const selectTaskDrawer = (state: RootState) => state.taskDrawerReducer;

// Settings selectors
export const selectMembers = (state: RootState) => state.memberReducer;
export const selectClients = (state: RootState) => state.clientReducer;
export const selectJobs = (state: RootState) => state.jobReducer;
export const selectTeams = (state: RootState) => state.teamReducer;
export const selectCategories = (state: RootState) => state.categoriesReducer;
export const selectLabels = (state: RootState) => state.labelReducer;

// Reporting selectors
export const selectReporting = (state: RootState) => state.reportingReducer;
export const selectProjectReports = (state: RootState) => state.projectReportsReducer;
export const selectMemberReports = (state: RootState) => state.membersReportsReducer;
export const selectTimeReports = (state: RootState) => state.timeReportsOverviewReducer;

// Admin and billing selectors
export const selectAdminCenter = (state: RootState) => state.adminCenterReducer;
export const selectBilling = (state: RootState) => state.billingReducer;

// Schedule and date selectors
export const selectSchedule = (state: RootState) => state.scheduleReducer;
export const selectDate = (state: RootState) => state.dateReducer;

// Feature-specific selectors
export const selectHomePage = (state: RootState) => state.homePageReducer;
export const selectAccountSetup = (state: RootState) => state.accountSetupReducer;
export const selectRoadmap = (state: RootState) => state.roadmapReducer;
export const selectGroupByFilter = (state: RootState) => state.groupByFilterDropdownReducer;

// Memoized computed selectors for common use cases
export const selectHasActiveProject = createSelector(
  [selectCurrentProject],
  project => !!project && Object.keys(project).length > 0
);

export const selectIsLoading = createSelector([selectTasks, selectProjects], (tasks, projects) => {
  // Check if any major feature is loading
  return (tasks as any)?.loading || (projects as any)?.loading;
});
