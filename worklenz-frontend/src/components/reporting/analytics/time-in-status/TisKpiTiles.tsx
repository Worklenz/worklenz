import React from 'react';
import { Card, Col, Row, Statistic, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import type { TimeInStatusSeriesResponse } from '@/types/reporting/analytics-time-in-status.types';

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

  return (
    <Row gutter={[12, 12]}>
      <Col xs={12} sm={6}>
        <Card size="small" style={tileStyle}>
          <Statistic
            title={t('tisKpiIssues', { defaultValue: 'Issues' })}
            value={summary.issue_count}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" style={tileStyle}>
          <Statistic
            title={t('tisKpiVisits', { defaultValue: 'Status visits' })}
            value={summary.status_visit_count}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" style={tileStyle}>
          <Statistic
            title={t('tisKpiAvgCycle', { defaultValue: 'Avg cycle (sum of avgs)' })}
            value={summary.avg_cycle_days ?? 0}
            suffix={t('cfdKpiDaysSub', { defaultValue: 'days' })}
            precision={2}
          />
        </Card>
      </Col>
      <Col xs={12} sm={6}>
        <Card size="small" style={tileStyle}>
          <Statistic
            title={t('tisKpiOutliers', { defaultValue: 'Outliers' })}
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
