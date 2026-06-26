export interface SlackChannelStatus {
  id: string;
  name: string;
  isActive: boolean;
}

export interface SlackIntegrationStatus {
  connected: boolean;
  workspaceConnected: boolean;
  channelCount: number;
  channels: SlackChannelStatus[];
}

export interface TeamsIntegrationStatus {
  connected: boolean;
  tenantConnected: boolean;
  channelCount: number;
}

export interface GitHubIntegrationStatus {
  connected: boolean;
  accountConnected: boolean;
  repositoryCount: number;
}

export interface ProjectIntegrationStatus {
  slack: SlackIntegrationStatus;
  teams: TeamsIntegrationStatus;
  github: GitHubIntegrationStatus;
}

export interface IntegrationItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: number;
  channels?: string[];
  comingSoon?: boolean;
  onClick?: () => void;
}
