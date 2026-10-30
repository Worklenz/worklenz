import React from 'react';
import { Flex, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface ChartTableWrapperProps {
  chart: React.ReactNode;
  table: React.ReactNode;
  /** @deprecated No longer rendered; kept optional for call-site compatibility. */
  chartTitle?: string;
  /** Optional footer under the table card, e.g. row count. */
  rowCount?: number;
}

/**
 * Report body layout from the reporting prototype:
 * chart card stacked above a separate table card.
 */
export const ChartTableWrapper: React.FC<ChartTableWrapperProps> = ({
  chart,
  table,
  rowCount,
}) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();

  const cardStyle: React.CSSProperties = {
    background: token.colorBgContainer,
    border: `1px solid ${token.colorBorderSecondary}`,
    borderRadius: token.borderRadiusLG,
  };

  return (
    <Flex vertical gap={16} style={{ width: '100%' }}>
      <div style={{ ...cardStyle, padding: 16 }} role="img" aria-hidden={false}>
        {chart}
      </div>

      <div style={{ ...cardStyle, overflow: 'auto' }} role="region" aria-live="polite">
        {table}
      </div>

      {typeof rowCount === 'number' ? (
        <Text type="secondary" style={{ fontSize: 12.5 }}>
          {t('showingRowCount', {
            defaultValue: 'Showing {{count}} rows',
            count: rowCount,
          })}
        </Text>
      ) : null}
    </Flex>
  );
};
