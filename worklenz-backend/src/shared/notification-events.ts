export type NotificationEventType =
  | "task_created"
  | "task_assigned"
  | "status_changed"
  | "task_completed"
  | "task_updated"
  | "priority_changed"
  | "due_date_changed"
  | "comment_added";

export const NOTIFICATION_EVENT_TYPES: NotificationEventType[] = [
  "task_created",
  "task_assigned",
  "status_changed",
  "task_completed",
  "task_updated",
  "priority_changed",
  "due_date_changed",
  "comment_added"
];

interface NotificationEventMeta {
  emoji: string;
  /** Key under `slack.<titleKey>.title` in the `external` i18n namespace (shared by Slack and Teams). */
  titleKey: string;
  defaultTitle: string;
}

const NOTIFICATION_EVENTS: Record<NotificationEventType, NotificationEventMeta> = {
  task_created: { emoji: "🆕", titleKey: "task_created", defaultTitle: "Task Created" },
  task_assigned: { emoji: "👤", titleKey: "task_assigned", defaultTitle: "Task Assigned" },
  task_completed: { emoji: "✅", titleKey: "task_completed", defaultTitle: "Task Completed" },
  comment_added: { emoji: "💬", titleKey: "comment_added", defaultTitle: "Comment Added" },
  priority_changed: { emoji: "🔺", titleKey: "priority_changed", defaultTitle: "Priority Changed" },
  due_date_changed: { emoji: "📅", titleKey: "due_date_changed", defaultTitle: "Due Date Changed" },
  task_updated: { emoji: "✏️", titleKey: "task_updated", defaultTitle: "Task Updated" },
  status_changed: { emoji: "🔄", titleKey: "task_status_changed", defaultTitle: "Task Status Changed" }
};

export function getNotificationEventMeta(type: string): NotificationEventMeta {
  return NOTIFICATION_EVENTS[type as NotificationEventType] ?? NOTIFICATION_EVENTS.status_changed;
}
