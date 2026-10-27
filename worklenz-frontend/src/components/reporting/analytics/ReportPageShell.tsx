import React from 'react';
import { Breadcrumb, Flex, Space, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { AnalyticsExportMenu, type AnalyticsExportFormat } from './AnalyticsExportMenu';
import { ChartTableToggle, type ChartTableMode } from './ChartTableToggle';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

export interface ReportPageShellCrumb {
  label: string;
  path?: string;
}

export interface ReportPageShellProps {
  title: string;
  crumbs?: ReportPageShellCrumb[];
  lastUpdatedAt?: string | Date | null;
  filters?: React.ReactNode;
  viewMode?: ChartTableMode;
  onViewModeChange?: (mode: ChartTableMode) => void;
  onExport?: (format: AnalyticsExportFormat) => void;
  exportDisabled?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const ReportPageShell: React.FC<ReportPageShellProps> = ({
  title,
  crumbs,
  lastUpdatedAt,
  filters,
  viewMode = 'chart',
  onViewModeChange,
  onExport,
  exportDisabled,
  actions,
  children,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();

  const lastUpdatedLabel = lastUpdatedAt
    ? t('lastUpdatedRelative', {
        defaultValue: 'Last updated: {{time}}',
        time: dayjs(lastUpdatedAt).fromNow(),
      })
    : t('lastUpdatedUnknown', { defaultValue: 'Last updated: —' });

  return (
    <Flex vertical gap={16} style={{ minHeight: '100%' }}>
      {crumbs && crumbs.length > 0 && (
        <Breadcrumb
          items={crumbs.map(crumb => ({
            title: crumb.path ? <Link to={crumb.path}>{crumb.label}</Link> : crumb.label,
          }))}
        />
      )}

      <Flex justify="space-between" align="flex-start" gap={16} wrap="wrap">
        <Flex vertical gap={4}>
          <Title level={3} style={{ margin: 0 }}>
            {title}
          </Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {lastUpdatedLabel}
          </Text>
        </Flex>

        <Space wrap>
          {onViewModeChange && (
            <ChartTableToggle value={viewMode} onChange={onViewModeChange} />
          )}
          {onExport && (
            <AnalyticsExportMenu onExport={onExport} disabled={exportDisabled} />
          )}
          {actions}
        </Space>
      </Flex>

      {filters && (
        <div
          style={{
            padding: 12,
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
          }}
        >
          {filters}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </Flex>
  );
};
