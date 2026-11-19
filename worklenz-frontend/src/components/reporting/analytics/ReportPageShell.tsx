import React from 'react';
import { Flex, Space, Typography, theme } from '@/shared/antd-imports';
import { AnalyticsExportMenu, type AnalyticsExportFormat } from './AnalyticsExportMenu';
import { AnalyticsScheduleAction } from './schedule/AnalyticsScheduleAction';

const { Title } = Typography;

export interface ReportPageShellScheduleConfig {
  reportKind: string;
  reportName: string;
  templateId?: string | null;
  getFilters: () => Record<string, unknown>;
  disabled?: boolean;
}

export interface ReportPageShellProps {
  title: string;
  filters?: React.ReactNode;
  onExport?: (format: AnalyticsExportFormat) => void;
  exportDisabled?: boolean;
  exportFormats?: AnalyticsExportFormat[];
  exportLoading?: boolean;
  /** When set, shows Schedule next to Export (prototype flow). */
  schedule?: ReportPageShellScheduleConfig;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const ReportPageShell: React.FC<ReportPageShellProps> = ({
  title,
  filters,
  onExport,
  exportDisabled,
  exportFormats,
  exportLoading,
  schedule,
  actions,
  children,
}) => {
  const { token } = theme.useToken();
  const hasToolbar = !!(filters || onExport || actions || schedule);

  return (
    <Flex vertical gap={16} style={{ minHeight: '100%' }}>
      <Title level={3} style={{ margin: 0 }}>
        {title}
      </Title>

      {hasToolbar && (
        <div
          style={{
            padding: 12,
            borderRadius: token.borderRadiusLG,
            border: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
          }}
        >
          <Flex
            justify="space-between"
            align="center"
            gap={12}
            wrap="wrap"
            style={{ width: '100%' }}
          >
            <div style={{ flex: '1 1 auto', minWidth: 0 }}>{filters}</div>
            {(actions || onExport || schedule) && (
              <Space wrap size={8}>
                {onExport && (
                  <AnalyticsExportMenu
                    onExport={onExport}
                    disabled={exportDisabled}
                    formats={exportFormats}
                    loading={exportLoading}
                  />
                )}
                {schedule && (
                  <AnalyticsScheduleAction
                    reportKind={schedule.reportKind}
                    reportName={schedule.reportName}
                    templateId={schedule.templateId}
                    getFilters={schedule.getFilters}
                    disabled={schedule.disabled}
                  />
                )}
              </Space>
            )}
          </Flex>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </Flex>
  );
};
