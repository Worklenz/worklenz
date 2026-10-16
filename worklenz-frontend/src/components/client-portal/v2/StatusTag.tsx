import React from 'react';
import { Tag } from '@/shared/antd-imports';

/**
 * Tag colours keep the earlier suite's convention: green good or done, red risk or blocked,
 * orange waiting, gray neutral, blue informational (purple for in-progress work).
 */
export type StatusTone = 'green' | 'red' | 'orange' | 'gray' | 'blue' | 'purple';

// Ant Design preset colours follow the active theme, so no per-theme hex values are needed.
const TONE_TO_PRESET: Record<StatusTone, string> = {
  green: 'success',
  red: 'error',
  orange: 'warning',
  gray: 'default',
  blue: 'processing',
  purple: 'purple',
};

interface StatusTagProps {
  tone: StatusTone;
  children: React.ReactNode;
  icon?: React.ReactNode;
  title?: string;
}

export const StatusTag = ({ tone, children, icon, title }: StatusTagProps) => (
  <Tag color={TONE_TO_PRESET[tone]} icon={icon} title={title} style={{ margin: 0 }}>
    {children}
  </Tag>
);
