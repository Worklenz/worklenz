import express from "express";

import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import {ITaskMovedToDoneRecord} from "../interfaces/task-moved-to-done";
import {IProjectDigest} from "../interfaces/project-digest";
import {ICommentEmailNotification} from "../interfaces/comment-email-notification";

const router = express.Router({strict: false});

const TEMPLATES_BASE = "../../worklenz-email-templates";

router.get("/task-assignee-change", (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
  const sampleData = {
    "name": "Jane Wanniarachchi",
    "email": "jane@example.com",
    "team_member_id": "e3f95f03-5ea7-4cf7-9f61-123c55d8f6d9",
    "teams": [
      {
        "id": "16c4ac3b-27c7-45e5-b32e-b78cc5d354b9",
        "name": "Automation",
        "team_member_id": "e3f95f03-5ea7-4cf7-9f61-123c55d8f6d9",
        "projects": [
          {
            "id": "6de9c9df-2193-4212-8d64-9dfc36a83ed2",
            "name": "Allen LLC",
            "tasks": [
              {
                "name": "Soloman's Island Project - SIM Registration + Central DB + KYC",
                "updater_name": "Jane",
                "members": "Jane, Jane Wanniarachchi, Pasindu Ishan"
              },
              {
                "name": "Theory everyone send half sure.",
                "updater_name": "Jane",
                "members": "Jane Wanniarachchi"
              }
            ]
          }
        ]
      },
      {
        "id": "33ad4f38-27a9-450d-8524-74e9469bca2b",
        "name": "AA",
        "team_member_id": "17a4a959-d83a-41e8-bcc6-6c9dca1eb021",
        "projects": []
      }
    ]
  };
  res.render(`${TEMPLATES_BASE}/email-notifications/task-assignee-change`, sampleData);
});

router.get("/daily-digest", (req: IWorkLenzRequest, res: IWorkLenzResponse) => {

  const teams = [
    {
      id: "16c4ac3b-27c7-45e5-b32e-b78cc5d354b9",
      name: "Automation",
      team_member_id: "e3f95f03-5ea7-4cf7-9f61-123c55d8f6d9",
      projects: [
        {
          id: "6de9c9df-2193-4212-8d64-9dfc36a83ed2",
          name: "Allen LLC",
          tasks: [
            {
              name: "Soloman's Island Project - SIM Registration + Central DB + KYC",
              members: "Jane, Jane Wanniarachchi, Pasindu Ishan"
            },
            {
              name: "Theory everyone send half sure.",
              members: "Jane Wanniarachchi"
            }
          ]
        }
      ]
    },
    {
      id: "33ad4f38-27a9-450d-8524-74e9469bca2b",
      name: "AA",
      team_member_id: "17a4a959-d83a-41e8-bcc6-6c9dca1eb021",
      projects: []
    }
  ];

  const sampleData = {
    greeting: "Hi Jane",
    note: "Here's your Monday update!",
    email: "jane@example.com",
    recently_assigned: teams,
    overdue: teams,
    recently_completed: teams
  };
  res.render(`${TEMPLATES_BASE}/email-notifications/daily-digest`, sampleData);
});

router.get("/daily-task-reminder", (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
  const sampleTask = {
    name: "Prepare weekly status report",
    taskUrl: "http://localhost:4200/worklenz/projects/6de9c9df-2193-4212-8d64-9dfc36a83ed2?tab=tasks-list&task=f8b3fc45-a28b-4d8f-985e-9e43f8577aa8",
    projectName: "Allen LLC",
    workspaceName: "Automation",
    priorityName: "High",
    dueDate: "2026-08-31",
    daysOverdue: 2,
    assigneeName: "Jane Smith",
    weekdayLabel: "Tuesday",
  };
  res.render(`${TEMPLATES_BASE}/email-notifications/daily-task-reminder`, {
    userName: "Jane",
    workspaceCount: 2,
    dueToday: { tasks: [sampleTask], totalCount: 1 },
    upcoming: { tasks: [], totalCount: 0 },
    overdue: { tasks: [sampleTask], totalCount: 1 },
    assignedByMeDueToday: { tasks: [], totalCount: 0 },
    assignedByMeOverdue: { tasks: [], totalCount: 0 },
    adminOverview: [],
    managePreferencesUrl: "/worklenz/settings/notifications",
    viewAllTasksUrl: "/worklenz/my-tasks",
    unsubscribeUrl: "/public/digest/unsubscribe?token=sample",
  });
});

router.get("/weekly-start-summary", (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
  const sampleTask = {
    name: "Prepare weekly status report",
    taskUrl: "http://localhost:4200/worklenz/projects/6de9c9df-2193-4212-8d64-9dfc36a83ed2?tab=tasks-list&task=f8b3fc45-a28b-4d8f-985e-9e43f8577aa8",
    projectName: "Allen LLC",
    workspaceName: "Automation",
    priorityName: "High",
    weekdayLabel: "Tuesday",
    daysOverdue: 1,
    assigneeName: "Jane Smith",
  };
  res.render(`${TEMPLATES_BASE}/email-notifications/weekly-start-summary`, {
    userName: "Jane",
    workspaceCount: 2,
    dueToday: { tasks: [sampleTask], totalCount: 1 },
    dueThisWeek: { tasks: [sampleTask], totalCount: 1 },
    overdue: { tasks: [], totalCount: 0 },
    assignedByMeDueToday: { tasks: [], totalCount: 0 },
    assignedByMeDueThisWeek: { tasks: [], totalCount: 0 },
    assignedByMeOverdue: { tasks: [], totalCount: 0 },
    adminOverview: [{
      workspaceName: "Automation",
      teams: [{ teamName: "Automation", dueToday: 3, dueThisWeek: 8, overdue: 2, memberCount: 5 }],
      totals: { dueToday: 3, dueThisWeek: 8, overdue: 2, memberCount: 5 },
    }],
    managePreferencesUrl: "/worklenz/settings/notifications",
    viewAllTasksUrl: "/worklenz/my-tasks",
    unsubscribeUrl: "/public/digest/unsubscribe?token=sample",
  });
});

router.get("/weekly-end-summary", (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
  const sampleTask = {
    name: "Prepare weekly status report",
    taskUrl: "http://localhost:4200/worklenz/projects/6de9c9df-2193-4212-8d64-9dfc36a83ed2?tab=tasks-list&task=f8b3fc45-a28b-4d8f-985e-9e43f8577aa8",
    projectName: "Allen LLC",
    workspaceName: "Automation",
    completedDay: "Wednesday",
    dueDate: "2026-08-28",
    assigneeName: "Jane Smith",
  };
  res.render(`${TEMPLATES_BASE}/email-notifications/weekly-end-summary`, {
    userName: "Jane",
    workspaceCount: 2,
    completed: { tasks: [sampleTask], totalCount: 1 },
    stillDue: { tasks: [], totalCount: 0 },
    becameOverdue: { tasks: [], totalCount: 0 },
    allTimeOverdueCount: 4,
    assignedByMeCompleted: { tasks: [], totalCount: 0 },
    assignedByMeBecameOverdue: { tasks: [], totalCount: 0 },
    adminOverview: [{
      workspaceName: "Automation",
      teams: [{ teamName: "Automation", completed: 12, overdueThisWeek: 2, allTimeOverdue: 4, dueNextWeek: 6 }],
      totals: { completed: 12, overdueThisWeek: 2, allTimeOverdue: 4, dueNextWeek: 6 },
    }],
    managePreferencesUrl: "/worklenz/settings/notifications",
    viewAllTasksUrl: "/worklenz/my-tasks",
    unsubscribeUrl: "/public/digest/unsubscribe?token=sample",
  });
});

router.get("/task-moved-to-done", (req: IWorkLenzRequest, res: IWorkLenzResponse) => {

  const task = {
    name: "Soloman's Island Project - SIM Registration + Central DB + KYC",
    members: "Jane, Jane Wanniarachchi, Pasindu Ishan",
    url: "http://localhost:4200/worklenz/projects/6de9c9df-2193-4212-8d64-9dfc36a83ed2?tab=tasks-list&task=f8b3fc45-a28b-4d8f-985e-9e43f8577aa8",
    team_name: "Automation",
    project_name: "Allen LLC"
  };

  const sampleData: ITaskMovedToDoneRecord = {
    greeting: "Hi Jane",
    summary: "Great news! a task just got completed!",
    settings_url: "/settings",
    task
  };
  res.render(`${TEMPLATES_BASE}/email-notifications/task-moved-to-done`, sampleData);
});

router.get("/project-daily-digest", (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
  const sampleData: IProjectDigest = {
    id: "",
    name: "Worklenz",
    team_name: "Acme Inc",
    greeting: `Hi Jane`,
    due_tomorrow: [],
    settings_url: "/",
    project_url: "/",
    subscribers: [],
    summary: `Here's the "Worklenz" summary | Acme Inc`,
    today_completed: [
      {
        id: "abc123",
        name: "Sample Task",
        url: "/",
        members: "John Doe, Jane Smith",
      }
    ],
    today_new: [],
  };
  res.render(`${TEMPLATES_BASE}/email-notifications/project-daily-digest`, sampleData);
});

router.get("/task-comment", (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
  const data: ICommentEmailNotification = {
    greeting: "Hi Jane",
    summary: `"Jane Smith" added a new comment on "Email Notifications"`,
    team: "Acme Inc",
    project_name: "Worklenz",
    comment: "Any updates on this?",
    task: "Email Notifications",
    settings_url: "/",
    task_url: "/",
  };

  res.render(`${TEMPLATES_BASE}/email-notifications/task-comment`, data);
});

export default router;
