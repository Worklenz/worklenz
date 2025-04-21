export type AlertType = 'success' | 'error' | 'info' | 'warning';

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  duration?: number;
  timestamp: number;
}

export interface AlertConfig {
  position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  duration: number;
  maxCount: number;
}

export interface AlertState {
  activeAlerts: Set<string>;
  config: AlertConfig;
}
