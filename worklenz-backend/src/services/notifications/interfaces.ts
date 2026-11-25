export interface INotification {
  user_ids: string[];
  message: string;
}

export interface IReceiver {
  /**
   * Prefer `user_id` for real-time delivery (emits to `user:{id}` room).
   * `receiver_socket_id` is a fallback for older call sites; it can be stale after reconnect.
   */
  receiver_socket_id?: string;
  user_id?: string;
  team: string;
  team_id: string;
  message: string;
  message_key?: string;
  message_params?: Record<string, any>;
  notification_type_key?: string;
  project_id?: string;
  project?: string;
  project_color?: string;
  task_id?: string;
  comment_id?: string;
  /** Optional in-app deep link. When set it replaces the default project link. */
  url?: string;
}

export interface ICreateNotificationRequest {
  userId: string;
  teamId: string;
  socketId?: string;
  message: string;
  messageKey?: string;
  messageParams?: Record<string, any>;
  notificationTypeKey?: string;
  taskId: string | null;
  projectId: string | null;
  commentId?: string;
  /** Optional in-app deep link stored with the notification (e.g. a Client Portal approval). */
  url?: string;
}
