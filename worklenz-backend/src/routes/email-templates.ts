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
    "name": "John Doe",
    "email": "johndoe.office@worklenz.com",
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
                "updater_name": "John Doe",
                "members": "John Doe, Jane Smith"
              },
              {
                "name": "Theory everyone send half sure.",
                "updater_name": "John Doe",
                "members": "John Doe, Jane Smith"
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
              members: "John Doe, Soloman"
            },
            {
              name: "Theory everyone send half sure.",
              members: "John Doe"
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
    greeting: "Hi John Doe",
    note: "Here's your Monday update!",
    email: "johndoe.office@gmail.com",
    recently_assigned: teams,
    overdue: teams,
    recently_completed: teams
  };
  res.render(`${TEMPLATES_BASE}/email-notifications/daily-digest`, sampleData);
});

router.get("/task-moved-to-done", (req: IWorkLenzRequest, res: IWorkLenzResponse) => {

  const task = {
    name: "Soloman's Island Project - SIM Registration + Central DB + KYC",
    members: "John Doe, Soloman",
    url: "http://localhost:4200/worklenz/projects/6de9c9df-2193-4212-8d64-9dfc36a83ed2?tab=tasks-list&task=f8b3fc45-a28b-4d8f-985e-9e43f8577aa8",
    team_name: "Automation",
    project_name: "Allen LLC"
  };

  const sampleData: ITaskMovedToDoneRecord = {
    greeting: "Hi John Doe",
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
    team_name: "Ceydigital",
    greeting: `Hi John Doe`,
    due_tomorrow: [],
    settings_url: "/",
    project_url: "/",
    subscribers: [],
    summary: `Here's the "Worklenz" summary | Ceydigital`,
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
    greeting: "Hi John Doe",
    summary: `"John Doe Office" added a new comment on "Email Notifications"`,
    team: "Ceydigital",
    project_name: "Worklenz",
    comment: "Any updates on this?",
    task: "Email Notifications",
    settings_url: "/",
    task_url: "/",
  };

  res.render(`${TEMPLATES_BASE}/email-notifications/task-comment`, data);
});

export default router;
