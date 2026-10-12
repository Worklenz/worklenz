/**
 * Fixture data for task-export CSV encoding / column tests.
 * Keep values deliberately awkward (commas, quotes, newlines, HTML, unicode).
 */

import {
  CommentExportSource,
  TaskExportCustomFieldDef,
  TaskExportSource,
} from "../../services/task-export-csv/types";

export const FIXTURE_CUSTOM_FIELDS: TaskExportCustomFieldDef[] = [
  { key: "story_points", name: "Story Points", field_type: "number" },
  { key: "client_ref", name: "Client Ref", field_type: "text" },
  { key: "approved", name: "Approved", field_type: "checkbox" },
  { key: "reviewers", name: "Reviewers", field_type: "people" },
];

/** Two fields sharing the same display name — headers must stay unique. */
export const FIXTURE_DUPLICATE_NAME_FIELDS: TaskExportCustomFieldDef[] = [
  { key: "field_a", name: "Notes", field_type: "text" },
  { key: "field_b", name: "Notes", field_type: "text" },
];

export const FIXTURE_TASK_PLAIN: TaskExportSource = {
  task_key: "ACME-1",
  name: "Plain task",
  description: "Simple description",
  status_name: "To Do",
  priority_name: "Medium",
  phase_name: "Discovery",
  assignees: [{ name: "Jane Doe" }],
  reporter: "John Smith",
  labels: [{ name: "Backend" }, { name: "Urgent" }],
  start_date: "2026-01-15T00:00:00.000Z",
  end_date: "2026-01-20T00:00:00.000Z",
  completed_at: null,
  total_minutes: 90,
  time_spent_seconds: 3600,
  progress: 25,
  parent_task_key: null,
  is_sub_task: false,
  created_at: "2026-01-10T08:30:00.000Z",
  updated_at: "2026-01-12T14:00:00.000Z",
  custom_column_values: {
    story_points: 5,
    client_ref: "CR-100",
    approved: true,
    reviewers: [{ name: "Alice" }, { name: "Bob" }],
  },
};

export const FIXTURE_TASK_ESCAPING: TaskExportSource = {
  task_key: "ACME-2",
  name: 'Task with "quotes", commas, and\nnewlines',
  description:
    '<p>Line one</p><p>Has a comma, and "quotes", plus<br/>a break</p>',
  status_name: "Doing",
  priority_name: "High",
  phase_name: null,
  assignees: ["Ada Lovelace", { name: "Grace Hopper" }],
  reporter: 'O\'Brien, "Pat"',
  labels: [],
  start_date: null,
  end_date: null,
  completed_at: "2026-02-01T12:00:00.000Z",
  total_minutes: 0,
  time_spent_seconds: 0,
  progress: 100,
  parent_task_key: "ACME-1",
  is_sub_task: true,
  created_at: "2026-01-11T09:00:00.000Z",
  updated_at: "2026-02-01T12:05:00.000Z",
  custom_column_values: {
    story_points: null,
    client_ref: 'Value, with "comma"',
    approved: false,
    reviewers: [],
  },
};

export const FIXTURE_TASK_UNICODE: TaskExportSource = {
  task_key: "ACME-3",
  name: "日本語タスク — café résumé 🚀",
  description: "Unicode: ñ é ü 中文",
  status_name: "Done",
  priority_name: "Low",
  phase_name: "Delivery",
  assignees: [],
  reporter: null,
  labels: [{ name: "i18n" }],
  start_date: "2026-03-01",
  end_date: "2026-03-05",
  completed_at: "2026-03-04",
  total_minutes: 125,
  time_spent_seconds: 7500,
  progress: 0,
  parent_task_key: "",
  is_sub_task: false,
  created_at: "2026-03-01T00:00:00.000Z",
  updated_at: "2026-03-04T18:00:00.000Z",
  custom_column_values: {},
};

export const FIXTURE_COMMENTS: CommentExportSource[] = [
  {
    task_key: "ACME-1",
    task_name: "Plain task",
    author_name: "Jane Doe",
    content: "Looks good",
    created_at: "2026-01-11T10:00:00.000Z",
    updated_at: "2026-01-11T10:00:00.000Z",
    is_edited: false,
  },
  {
    task_key: "ACME-2",
    task_name: 'Task with "quotes", commas, and\nnewlines',
    author_name: "Pat",
    content: 'Please fix the "bug", and add\na note',
    created_at: "2026-01-12T11:00:00.000Z",
    updated_at: "2026-01-13T09:30:00.000Z",
    is_edited: true,
  },
];

/** Comment body stored with `{n}` mention placeholders (DB form). */
export const FIXTURE_COMMENT_WITH_MENTIONS: CommentExportSource = {
  task_key: "ACME-1",
  task_name: "Plain task",
  author_name: "Jane Doe",
  content: "Hey {0}, can you review this with {1}?",
  created_at: "2026-01-14T10:00:00.000Z",
  updated_at: "2026-01-14T10:00:00.000Z",
  is_edited: false,
  mentions: [{ user_name: "Alice Smith" }, { user_name: "Bob Jones" }],
};
