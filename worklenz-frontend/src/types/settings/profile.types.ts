export interface IProfileSettings {
  id?: string;
  name?: string;
  email?: string;
  updated_at?: string;
}

export interface IGoogleCalendarStatus {
  connected: boolean;
  connected_at?: string;
  projects: Array<{ id: string; name: string }>;
}

export interface IGoogleCalendarSyncResult {
  imported: number;
  updated: number;
  removed: number;
  pushed: number;
}
