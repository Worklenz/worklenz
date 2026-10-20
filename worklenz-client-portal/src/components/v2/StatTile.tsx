import type { ReactNode } from 'react';
import { Card, Statistic, Typography, theme } from '@/shared/antd-imports';

interface StatTileProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Semantic colour for the value, from the theme tokens: warning, success, error. */
  tone?: 'warning' | 'success' | 'error';
  onClick?: () => void;
}

/** A summary number: tiles on the dashboard and the change request list. */
export const StatTile = ({ label, value, sub, tone, onClick }: StatTileProps) => {
  const { token } = theme.useToken();
  const color = tone === 'warning' ? token.colorWarning : tone === 'success' ? token.colorSuccess : tone === 'error' ? token.colorError : undefined;
  return (
    <Card
      size="small"
      hoverable={Boolean(onClick)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? event => (event.key === 'Enter' || event.key === ' ') && onClick() : undefined}
      style={{ height: '100%' }}
    >
      <Statistic title={label} value={value as string | number} valueStyle={{ color, fontSize: 26 }} />
      {sub && (
        <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
          {sub}
        </Typography.Text>
      )}
    </Card>
  );
};
