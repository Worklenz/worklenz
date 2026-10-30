import React from 'react';
import { Card, Col, Flex, Row, Statistic, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type { TimeInStatusSeriesResponse } from '@/types/reporting/analytics-time-in-status.types';
import { MetricCalcHint } from '../MetricCalcHint';

interface TisKpiTilesProps {
  summary: TimeInStatusSeriesResponse['summary'];
}

export const TisKpiTiles: React.FC<TisKpiTilesProps> = ({ summary }) => {
  const { t } = useTranslation('reporting-analytics');
  const { token } = theme.useToken();

  const tileStyle: React.CSSProperties = {
    background: token.colorBgContainer,
    borderRadius: token.borderRadiusLG,
    border: `1px solid ${token.colorBorderSecondary}`,
  };

  const titleWithHint = (label: string, tooltip: string) => (
    <Flex align="center" gap={6} wrap="wrap">
      <span>{label}</span>
      <MetricCalcHint title={tooltip} color={token.colorTextSecondary} />
    </Flex>
  );

  return (
    <Row gutter={[12, 12]}>
      <Col xs={12} sm={6}>
        <Card size="small" style={tileStyle}>
          <Statistic
            title={titleWithHint(
              t('tisKpiIssues', { defaultValue: 'Issues' }),
              t('tisCalcIssues', {
                defaultValue: 'Number of tasks with status history included in this report.',
              })
            )}
            value={summary.issue_count}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" style={tileStyle}>
          <Statistic
            title={titleWithHint(
              t('tisKpiVisits', { defaultValue: 'Status visits' }),
              t('tisCalcVisits', {
                defaultValue:
                  'Total times tasks entered a status (one task can visit multiple statuses).',
              })
            )}
            value={summary.status_visit_count}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" style={tileStyle}>
          <Statistic
            title={titleWithHint(
              t('tisKpiAvgCycle', { defaultValue: 'Avg cycle (sum of avgs)' }),
              t('tisCalcAvgCycle', {
                defaultValue:
                  'Sum of average days spent in each status — an estimate of overall cycle time.',
              })
            )}
            value={summary.avg_cycle_days ?? 0}
            suffix={t('cfdKpiDaysSub', { defaultValue: 'days' })}
            precision={2}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" style={tileStyle}>
          <Statistic
            title={titleWithHint(
              t('tisKpiOutliers', { defaultValue: 'Outliers' }),
              t('tisCalcOutliers', {
                defaultValue:
                  'Tasks whose time in a status is unusually high compared with peers (statistical outliers).',
              })
            )}
            value={summary.outlier_count}
            valueStyle={
              summary.outlier_count > 0 ? { color: token.colorError } : undefined
            }
          />
        </Card>
      </Col>
    </Row>
  );
};
