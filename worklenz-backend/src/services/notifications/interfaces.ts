export interface INotification {
  user_ids: string[];
  message: string;
}

export interface IReceiver {
  receiver_socket_id: string;
  team: string;
  team_id: string;
  message: string;
  project_id?: string;
  project?: string;
  project_color?: string;
  task_id?: string;
}

export interface ICreateNotificationRequest {
  userId: string;
  teamId: string;
  socketId: string;
  message: string;
  taskId: string | null;
  projectId: string | null;
}
