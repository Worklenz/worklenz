import React from 'react';
import { Button, Empty, Flex, Result, Skeleton, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

export const ReportLoadingSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => {
  const { token } = theme.useToken();
  return (
    <Flex vertical gap={12} style={{ padding: 8 }}>
      <Skeleton.Input active style={{ width: 220, height: 28 }} />
      <div
        style={{
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${token.colorBorderSecondary}`,
          padding: 16,
        }}
      >
        <Skeleton active paragraph={{ rows }} />
      </div>
    </Flex>
  );
};

interface ReportEmptyStateProps {
  title?: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export const ReportEmptyState: React.FC<ReportEmptyStateProps> = ({
  title,
  description,
  ctaLabel,
  onCta,
}) => {
  const { t } = useTranslation('reporting-analytics');

  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <Flex vertical gap={4} align="center">
          <Text strong>
            {title ?? t('emptyTitle', { defaultValue: 'No data for this time period' })}
          </Text>
          <Text type="secondary">
            {description ??
              t('emptyDescription', {
                defaultValue: 'Try adjusting filters or selecting another project.',
              })}
          </Text>
        </Flex>
      }
    >
      {onCta && (
        <Button type="primary" onClick={onCta}>
          {ctaLabel ?? t('emptyCta', { defaultValue: 'Clear filters' })}
        </Button>
      )}
    </Empty>
  );
};

interface ReportErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ReportErrorState: React.FC<ReportErrorStateProps> = ({ message, onRetry }) => {
  const { t } = useTranslation('reporting-analytics');

  return (
    <Result
      status="error"
      title={t('errorTitle', { defaultValue: 'Something went wrong' })}
      subTitle={
        message ??
        t('errorDescription', { defaultValue: 'We could not load this report. Please try again.' })
      }
      extra={
        onRetry ? (
          <Button type="primary" onClick={onRetry}>
            {t('retry', { defaultValue: 'Retry' })}
          </Button>
        ) : undefined
      }
    />
  );
};

/** Compact empty state for use inside a chart card. */
export const InChartEmptyState: React.FC<{ message?: string }> = ({ message }) => {
  const { t } = useTranslation('reporting-analytics');
  return (
    <Flex align="center" justify="center" style={{ minHeight: 220, width: '100%' }}>
      <Text type="secondary">
        {message ?? t('inChartEmpty', { defaultValue: 'No data for this time period' })}
      </Text>
    </Flex>
  );
};
