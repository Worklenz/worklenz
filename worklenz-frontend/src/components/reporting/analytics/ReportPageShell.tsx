import React from 'react';
import { Flex, Space, Typography, theme } from '@/shared/antd-imports';
import { AnalyticsExportMenu, type AnalyticsExportFormat } from './AnalyticsExportMenu';

const { Title } = Typography;

export interface ReportPageShellProps {
  title: string;
  filters?: React.ReactNode;
  onExport?: (format: AnalyticsExportFormat) => void;
  exportDisabled?: boolean;
  exportFormats?: AnalyticsExportFormat[];
  exportLoading?: boolean;
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
  actions,
  children,
}) => {
  const { token } = theme.useToken();

  return (
    <Flex vertical gap={16} style={{ minHeight: '100%' }}>
      <Title level={3} style={{ margin: 0 }}>
        {title}
      </Title>

      {(filters || onExport || actions) && (
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
            {(actions || onExport) && (
              <Space wrap size={8}>
                {actions}
                {onExport && (
                  <AnalyticsExportMenu
                    onExport={onExport}
                    disabled={exportDisabled}
                    formats={exportFormats}
                    loading={exportLoading}
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
