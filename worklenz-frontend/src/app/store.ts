import { configureStore } from '@reduxjs/toolkit';

// Auth & User
import authReducer from '@features/auth/auth-slice';
import userReducer from '@features/user/user-slice';

// Home Page
import homePageReducer from '@features/home-page/home-page.slice';

// Account Setup
import accountSetupReducer from '@features/account-setup/account-setup.slice';

// Core UI
import themeReducer from '@features/theme/theme.slice';
import localesReducer from '@features/i18n/locales-slice';
import alertsReducer from '@services/alerts/alert-slice';

// Projects
import projectReducer from '@features/project/project.slice';
import projectsReducer from '@features/projects/projects-slice';
import projectMemberReducer from '@features/projects/singleProject/members/project-members-slice';
import projectViewTaskListColumnsReducer from '@features/projects/singleProject/taskListColumns/task-columns-slice';
import phaseReducer from '@features/projects/singleProject/phase/phases.slice';
import updatesReducer from '@features/projects/singleProject/updates/updates-slice';
import statusReducer from '@features/projects/status/status-slice';
import deleteStatusReducer from '@features/projects/status/delete-status.slice';
import bulkActionReducer from '@features/projects/bulk-actions/bulk-action.slice';
import projectInsightsReducer from '@features/projects/insights/project-insights.slice';
import taskListCustomColumnsReducer from '@features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import boardReducer from '@features/board/board-slice';
import projectDrawerReducer from '@features/project/project-drawer.slice';

// Project Lookups
import projectCategoriesReducer from '@features/projects/lookups/project-categories/project-categories.slice';
import projectStatusesReducer from '@features/projects/lookups/project-statuses/project-statuses.slice';
import projectHealthReducer from '@features/projects/lookups/project-health/project-health.slice';

// Tasks
import taskReducer from '@features/tasks/tasks.slice';
import createCardReducer from '@features/board/create-card.slice';
import priorityReducer from '@features/task-attributes/task-priority.slice';
import taskLabelsReducer from '@features/task-attributes/task-label.slice';
import taskStatusReducer, { deleteStatus } from '@features/task-attributes/task-status.slice';
import taskDrawerReducer from '@features/task-drawer/task-drawer.slice';

// Settings & Management
import memberReducer from '@features/settings/member/member.slice';
import clientReducer from '@features/settings/client/client.slice';
import jobReducer from '@features/settings/job/job-slice';
import teamReducer from '@features/teams/team-slice';
import billingReducer from '@/features/admin-center/billing/billing.slice';
import categoriesReducer from '@features/settings/categories/categories-slice';
import labelReducer from '@features/settings/label/label-slice';

// Admin Center
import adminCenterReducer from '@features/admin-center/admin-center.slice';

// Features
import dateReducer from '@features/date/date-slice';
import notificationReducer from '@/features/navbar/notification-slice';
import buttonReducer from '@features/action-setup/button-slice';
import scheduleReducer from '@features/schedule/schedule-slice';

// Reports
import reportingReducer from '@features/reporting/reporting.slice';
import timeLogReducer from '@features/timeReport/projects/time-log.slice';
import taskTemplateReducer from '@/features/settings/task-templates/task-template-slice';
import projectReportsTableColumnsReducer from '@features/reporting/projectReports/project-reports-table-column-slice/project-reports-table-column-slice';
import projectReportsReducer from '@features/reporting/projectReports/project-reports-slice';
import membersReportsReducer from '@features/reporting/membersReports/members-reports-slice';
import timeReportsOverviewReducer from '@features/reporting/time-reports/time-reports-overview.slice';

import roadmapReducer from '../features/roadmap/roadmap-slice';
import teamMembersReducer from '@features/team-members/team-members.slice';
import groupByFilterDropdownReducer from '../features/group-by-filter-dropdown/group-by-filter-dropdown-slice';

// Task Management System
import taskManagementReducer from '@features/task-management/task-management.slice';
import groupingReducer from '@features/task-management/grouping.slice';
import selectionReducer from '@features/task-management/selection.slice';
import homePageApiService from '@/api/home-page/home-page.api.service';
import { projectsApi } from '@/api/projects/projects.v1.api.service';

import projectViewReducer from '@features/project/project-view-slice';

export const store = configureStore({
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(homePageApiService.middleware, projectsApi.middleware),
  reducer: {
    // Auth & User
    auth: authReducer,
    userReducer: userReducer,

    // Account Setup
    accountSetupReducer: accountSetupReducer,

    // Home Page
    homePageReducer: homePageReducer,
    [homePageApiService.reducerPath]: homePageApiService.reducer,
    [projectsApi.reducerPath]: projectsApi.reducer,
    // Core UI
    themeReducer: themeReducer,
    localesReducer: localesReducer,
    alertsReducer: alertsReducer,

    // Projects
    projectReducer: projectReducer,
    projectsReducer: projectsReducer,
    projectMemberReducer: projectMemberReducer,
    teamMembersReducer: teamMembersReducer,
    projectViewTaskListColumnsReducer: projectViewTaskListColumnsReducer,
    phaseReducer: phaseReducer,
    updatesReducer: updatesReducer,
    statusReducer: statusReducer,
    deleteStatusReducer: deleteStatusReducer,
    bulkActionReducer: bulkActionReducer,
    projectInsightsReducer: projectInsightsReducer,
    taskListCustomColumnsReducer: taskListCustomColumnsReducer,
    boardReducer: boardReducer,
    projectDrawerReducer: projectDrawerReducer,
    
    projectViewReducer: projectViewReducer,

    // Project Lookups
    projectCategoriesReducer: projectCategoriesReducer,
    projectStatusesReducer: projectStatusesReducer,
    projectHealthReducer: projectHealthReducer,

    // Tasks
    taskReducer: taskReducer,
    createCardReducer: createCardReducer,
    priorityReducer: priorityReducer,
    taskLabelsReducer: taskLabelsReducer,
    taskStatusReducer: taskStatusReducer,
    taskDrawerReducer: taskDrawerReducer,

    // Settings & Management
    memberReducer: memberReducer,
    clientReducer: clientReducer,
    jobReducer: jobReducer,
    teamReducer: teamReducer,
    billingReducer: billingReducer,
    categoriesReducer: categoriesReducer,
    labelReducer: labelReducer,

    // Admin Center
    adminCenterReducer: adminCenterReducer,

    // Features
    dateReducer: dateReducer,
    notificationReducer: notificationReducer,
    button: buttonReducer,
    scheduleReducer: scheduleReducer,

    // Reports
    reportingReducer: reportingReducer,
    timeLogReducer: timeLogReducer,
    taskTemplateReducer: taskTemplateReducer,
    projectReportsTableColumnsReducer: projectReportsTableColumnsReducer,
    projectReportsReducer: projectReportsReducer,
    membersReportsReducer: membersReportsReducer,
    roadmapReducer: roadmapReducer,
    groupByFilterDropdownReducer: groupByFilterDropdownReducer,
    timeReportsOverviewReducer: timeReportsOverviewReducer,

    // Task Management System
    taskManagement: taskManagementReducer,
    grouping: groupingReducer,
    taskManagementSelection: selectionReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
