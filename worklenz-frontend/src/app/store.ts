import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

// Auth & User
import authReducer from '@features/auth/authSlice';
import userReducer from '@features/user/userSlice';

// Home Page
import homePageReducer from '@features/home-page/home-page.slice';
import userActivityReducer from '@features/home-page/user-activity.slice';

// Account Setup
import accountSetupReducer from '@features/account-setup/account-setup.slice';

// Core UI
import themeReducer from '@features/theme/themeSlice';
import localesReducer from '@features/i18n/localesSlice';
import alertsReducer from '@/services/alerts/alertSlice';

// Projects
import projectReducer from '@features/project/project.slice';
import projectsReducer from '@features/projects/projectsSlice';
import projectMemberReducer from '@features/projects/singleProject/members/projectMembersSlice';
import projectViewTaskListColumnsReducer from '@features/projects/singleProject/taskListColumns/taskColumnsSlice';
import phaseReducer from '@/features/projects/singleProject/phase/phases.slice';
import updatesReducer from '../features/projects/singleProject/updates/updatesSlice';
import statusReducer from '@features/projects/status/StatusSlice';
import deleteStatusReducer from '@features/projects/status/DeleteStatusSlice';
import bulkActionReducer from '@features/projects/bulkActions/bulkActionSlice';
import projectInsightsReducer from '@features/projects/insights/project-insights.slice';
import taskListCustomColumnsReducer from '@features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import boardReducer from '@features/board/board-slice';
import projectDrawerReducer from '@features/project/project-drawer.slice';

// Project Lookups
import projectCategoriesReducer from '@features/projects/lookups/projectCategories/projectCategoriesSlice';
import projectStatusesReducer from '@features/projects/lookups/projectStatuses/projectStatusesSlice';
import projectHealthReducer from '@features/projects/lookups/projectHealth/projectHealthSlice';

// Tasks
import taskReducer from '@features/tasks/tasks.slice';
import createCardReducer from '@/features/board/create-card.slice';
import priorityReducer from '@features/taskAttributes/taskPrioritySlice';
import taskLabelsReducer from '@features/taskAttributes/taskLabelSlice';
import taskStatusReducer, { deleteStatus } from '@features/taskAttributes/taskStatusSlice';
import taskDrawerReducer from '@features/task-drawer/task-drawer.slice';
import enhancedKanbanReducer from '@features/enhanced-kanban/enhanced-kanban.slice';

// Settings & Management
import memberReducer from '@features/settings/member/memberSlice';
import clientReducer from '@features/settings/client/clientSlice';
import jobReducer from '@features/settings/job/jobSlice';
import teamReducer from '@features/teams/teamSlice';
import billingReducer from '@/features/admin-center/billing/billing.slice';
import categoriesReducer from '@features/settings/categories/categoriesSlice';
import labelReducer from '@features/settings/label/labelSlice';

// Admin Center
import adminCenterReducer from '@features/admin-center/admin-center.slice';

// Features
import dateReducer from '@features/date/dateSlice';
import notificationReducer from '@/features/navbar/notificationSlice';
import buttonReducer from '@features/actionSetup/buttonSlice';
import scheduleReducer from '../features/schedule/scheduleSlice';
import scheduleRTKReducer from '../features/schedule/scheduleSliceRTK';

// Reports
import reportingReducer from '@features/reporting/reporting.slice';
import timeLogReducer from '../features/timeReport/projects/timeLogSlice';
import taskTemplateReducer from '../features/settings/taskTemplates/taskTemplateSlice';
import projectReportsTableColumnsReducer from '../features/reporting/projectReports/project-reports-table-column-slice/project-reports-table-column-slice';
import projectReportsReducer from '../features/reporting/projectReports/project-reports-slice';
import membersReportsReducer from '../features/reporting/membersReports/membersReportsSlice';
import timeReportsOverviewReducer from '@features/reporting/time-reports/time-reports-overview.slice';

import roadmapReducer from '../features/roadmap/roadmap-slice';
import teamMembersReducer from '@features/team-members/team-members.slice';
import groupByFilterDropdownReducer from '../features/group-by-filter-dropdown/group-by-filter-dropdown-slice';

// Task Management System
import taskManagementReducer from '@/features/task-management/task-management.slice';
import groupingReducer from '@/features/task-management/grouping.slice';
import selectionReducer from '@/features/task-management/selection.slice';
import homePageApiService from '@/api/home-page/home-page.api.service';
import { projectsApi } from '@/api/projects/projects.v1.api.service';
import { userActivityApiService } from '@/api/home-page/user-activity.api.service';
import { roadmapApi } from '@/pages/projects/projectView/gantt/services/roadmap-api.service';
import projectWorkloadApi from '@/api/project-workload/project-workload.api.service';

import projectViewReducer from '@features/project/project-view-slice';
import taskManagementFieldsReducer from '@features/task-management/taskListFields.slice';
import projectWorkloadReducer from '@features/project-workload/projectWorkloadSlice';

//clients portal
import clientsPortalReducer from '../features/clients-portal';

//client view
import clientViewReducer from '../features/client-view';

// Client Portal API
import { clientPortalApi } from '@/api/client-portal/client-portal-api';

// Schedule API
import { scheduleApi } from '@/api/schedule/scheduleApi';

import projectFinanceRateCardReducer from '@/features/finance/project-finance-slice';
import projectFinancesReducer from '@/features/projects/finance/project-finance.slice';
import financeReducer from '@/features/projects/finance/finance-slice';

export const store = configureStore({
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: false,
    }).concat(
      homePageApiService.middleware,
      projectsApi.middleware,
      clientPortalApi.middleware,
      userActivityApiService.middleware,
      roadmapApi.middleware,
      projectWorkloadApi.middleware,
      scheduleApi.middleware
    ),
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
    [clientPortalApi.reducerPath]: clientPortalApi.reducer,
    [roadmapApi.reducerPath]: roadmapApi.reducer,
    [projectWorkloadApi.reducerPath]: projectWorkloadApi.reducer,
    [scheduleApi.reducerPath]: scheduleApi.reducer,
    userActivityReducer: userActivityReducer,
    [userActivityApiService.reducerPath]: userActivityApiService.reducer,

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
    projectWorkload: projectWorkloadReducer,

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
    enhancedKanbanReducer: enhancedKanbanReducer,

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
    schedule: scheduleRTKReducer,

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
    taskManagementFields: taskManagementFieldsReducer,

    //clients portal
    clientsPortalReducer: clientsPortalReducer,

    //client view
    clientViewReducer: clientViewReducer,
    // Finance
    projectFinanceRateCardReducer: projectFinanceRateCardReducer,
    projectFinancesReducer: projectFinancesReducer,
    financeReducer: financeReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
