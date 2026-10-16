import React from 'react';
import { Card, theme } from '@/shared/antd-imports';

export type StatTone = 'default' | 'success' | 'warning' | 'danger';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Secondary line, e.g. "2 expired" or "Not visible to clients". */
  sub?: React.ReactNode;
  tone?: StatTone;
  onClick?: () => void;
}

/** One stat card shared by every v2 list page (replaces the per-file copies in the v1 pages). */
export const StatCard = ({ label, value, sub, tone = 'default', onClick }: StatCardProps) => {
  const { token } = theme.useToken();

  const valueColor = {
    default: token.colorText,
    success: token.colorSuccess,
    warning: token.colorWarning,
    danger: token.colorError,
  }[tone];

  const clickable = typeof onClick === 'function';

  return (
    <Card
      size="small"
      hoverable={clickable}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      styles={{ body: { padding: 16 } }}
      style={{ height: '100%', cursor: clickable ? 'pointer' : 'default' }}
    >
      <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.3, color: valueColor }}>
        {value}
      </div>
      {sub != null && (
        <div style={{ fontSize: 12, color: token.colorTextTertiary, marginTop: 2 }}>{sub}</div>
      )}
    </Card>
  );
};
