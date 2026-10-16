import type { ReactNode } from 'react';
import {
  AuditOutlined,
  BellOutlined,
  FileTextOutlined,
  FlagOutlined,
  LockOutlined,
  MessageOutlined,
  ProjectOutlined,
  SwapOutlined,
} from '@/shared/antd-imports';
import type { NotificationType } from '@/types/v2';

const ICONS: Record<NotificationType, ReactNode> = {
  Approval: <AuditOutlined />,
  Comment: <MessageOutlined />,
  File: <FileTextOutlined />,
  Milestone: <FlagOutlined />,
  Project: <ProjectOutlined />,
  'Change Request': <SwapOutlined />,
  Access: <LockOutlined />,
};

export const notificationIcon = (type: NotificationType): ReactNode => ICONS[type] ?? <BellOutlined />;

/** The seven event types a client is notified about (umbrella #2520). */
export const NOTIFICATION_TYPES: NotificationType[] = [
  'Approval',
  'Comment',
  'File',
  'Milestone',
  'Project',
  'Change Request',
  'Access',
];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  Approval: 'Approval requests and decisions',
  Comment: 'Replies to your comments and mentions',
  File: 'Files shared with you',
  Milestone: 'Milestone changes',
  Project: 'Project updates',
  'Change Request': 'Change request updates',
  Access: 'Changes to your access',
};
