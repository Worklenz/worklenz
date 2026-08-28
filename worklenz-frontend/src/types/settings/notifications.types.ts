export interface INotificationSettings {
  email_notifications_enabled?: boolean;
  popup_notifications_enabled?: boolean;
  show_unread_items_count?: boolean;
  daily_digest_enabled?: boolean;
}

export interface IDigestPreferences {
  daily_enabled?: boolean;
  daily_send_time?: string;
  weekly_start_enabled?: boolean;
  weekly_start_send_time?: string;
  weekly_end_enabled?: boolean;
  weekly_end_send_time?: string;
}
