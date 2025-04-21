export interface MixpanelConfig {
  debug?: boolean;
  track_pageview?: boolean;
  persistence?: 'localStorage' | 'cookie';
}

export interface UserProperties {
  name?: string;
  email?: string;
  [key: string]: any;
}

export interface EventProperties {
  [key: string]: any;
}
