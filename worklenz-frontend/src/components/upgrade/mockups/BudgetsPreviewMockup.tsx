import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Col,
  Row,
  Statistic,
  Progress,
  Flex,
  Typography,
  WalletOutlined,
  DollarOutlined,
  ExclamationCircleOutlined,
} from '@/shared/antd-imports';
import { PieChartOutlined } from '@ant-design/icons';

const { Text } = Typography;

const BUDGETS = [
  { key: '1', project: 'Nimbus Retail Website', budget: '$42,000', used: 76 },
  { key: '2', project: 'Beacon Logistics App', budget: '$68,000', used: 77 },
  { key: '3', project: 'Solace Patient Portal', budget: '$25,000', used: 107 },
  { key: '4', project: 'Vertex Inventory System', budget: '$54,000', used: 40 },
];

const usedColor = (pct: number) => {
  if (pct > 100) return '#ff4d4f';
  if (pct > 80) return '#faad14';
  return '#52c41a';
};

const BudgetsPreviewMockup: React.FC = () => {
  const { t } = useTranslation('upgrade-preview');
  const tp = (key: string, defaultValue: string) => t(`financeMockups.budgets.${key}`, { defaultValue });

  return (
    <Flex vertical gap={24}>
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title={tp('totalBudget', 'Total Budget')} value={189000} prefix={<WalletOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title={tp('spent', 'Spent')} value={132600} prefix={<DollarOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={tp('remaining', 'Remaining')}
              value={56400}
              valueStyle={{ color: '#52c41a' }}
              prefix={<PieChartOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={tp('overBudget', 'Over Budget')}
              value={1}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title={tp('budgetVsSpendCard', 'Budget vs. Spend by Project')}>
        <Flex vertical gap={16}>
          {BUDGETS.map(b => (
            <Flex key={b.key} vertical gap={4}>
              <Flex justify="space-between">
                <Text>{b.project}</Text>
                <Text type="secondary">{b.budget}</Text>
              </Flex>
              <Progress
                percent={Math.min(b.used, 100)}
                showInfo={false}
                strokeColor={usedColor(b.used)}
              />
            </Flex>
          ))}
        </Flex>
      </Card>
    </Flex>
  );
};

export default BudgetsPreviewMockup;
