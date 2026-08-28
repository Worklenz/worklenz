import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Col,
  Row,
  Statistic,
  Flex,
  DollarOutlined,
  CalculatorOutlined,
  ArrowUpOutlined,
} from '@/shared/antd-imports';
import { RiseOutlined } from '@ant-design/icons';
import MockBarChart from './MockBarChart';

// Fake per-project labels below stand in for real (untranslated) user data,
// same as on the real page — only the surrounding UI chrome is translated.
const MARGIN_BY_PROJECT = [
  { label: 'Nimbus Retail', value: 76, color: '#52c41a' },
  { label: 'Beacon Logistics', value: 55, color: '#52c41a' },
  { label: 'Solace Portal', value: 22, color: '#faad14' },
  { label: 'Vertex Inventory', value: 68, color: '#52c41a' },
  { label: 'Northwind Studio', value: 12, color: '#ff4d4f' },
];

const ProfitabilityPreviewMockup: React.FC = () => {
  const { t } = useTranslation('upgrade-preview');
  const tp = (key: string, defaultValue: string) =>
    t(`financeMockups.profitability.${key}`, { defaultValue });

  return (
    <Flex vertical gap={24}>
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title={tp('totalRevenue', 'Total Revenue')} value={189000} prefix={<DollarOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title={tp('totalCost', 'Total Cost')} value={132600} prefix={<CalculatorOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={tp('netProfit', 'Net Profit')}
              value={56400}
              prefix={<ArrowUpOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title={tp('avgMargin', 'Avg. Margin')} value={29.8} suffix="%" prefix={<RiseOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card title={tp('marginByProjectCard', 'Profit Margin by Project')}>
        <MockBarChart data={MARGIN_BY_PROJECT} />
      </Card>
    </Flex>
  );
};

export default ProfitabilityPreviewMockup;
