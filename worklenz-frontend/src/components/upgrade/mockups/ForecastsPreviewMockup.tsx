import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Col, Row, Statistic, Flex, DollarOutlined, ArrowUpOutlined } from '@/shared/antd-imports';
import { CompassOutlined } from '@ant-design/icons';
import MockBarChart from './MockBarChart';

const FORECAST_TREND = [
  { label: 'Mar', value: 45, color: '#91caff' },
  { label: 'Apr', value: 55, color: '#91caff' },
  { label: 'May', value: 62, color: '#91caff' },
  { label: 'Jun', value: 74, color: '#1677ff' },
  { label: 'Jul', value: 88, color: '#1677ff' },
  { label: 'Aug', value: 100, color: '#1677ff' },
];

const ForecastsPreviewMockup: React.FC = () => {
  const { t } = useTranslation('upgrade-preview');
  const tp = (key: string, defaultValue: string) => t(`financeMockups.forecasts.${key}`, { defaultValue });

  return (
    <Flex vertical gap={24}>
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title={tp('forecastedRevenue', 'Forecasted Revenue')} value={248000} prefix={<DollarOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title={tp('forecastedCost', 'Forecasted Cost')} value={171000} prefix={<CompassOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={tp('projectedMargin', 'Projected Margin')}
              value={31.0}
              suffix="%"
              valueStyle={{ color: '#52c41a' }}
              prefix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title={tp('forecastWindow', 'Forecast Window')} value={6} suffix="mo" />
          </Card>
        </Col>
      </Row>

      <Card title={tp('revenueTrendCard', 'Revenue Forecast Trend')}>
        <MockBarChart data={FORECAST_TREND} />
      </Card>
    </Flex>
  );
};

export default ForecastsPreviewMockup;
