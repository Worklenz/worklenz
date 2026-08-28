import React from 'react';
import {
  Card,
  Col,
  Row,
  Statistic,
  Table,
  Progress,
  Flex,
  Typography,
  DollarOutlined,
  CalculatorOutlined,
  ProjectOutlined,
  ArrowUpOutlined,
} from '@/shared/antd-imports';

const { Text } = Typography;

const FAKE_PROJECTS = [
  { key: '1', project: 'Nimbus Retail Website', budget: '$42,000', cost: '$31,900', utilization: 76 },
  { key: '2', project: 'Beacon Logistics App', budget: '$68,000', cost: '$52,300', utilization: 77 },
  { key: '3', project: 'Solace Patient Portal', budget: '$25,000', cost: '$26,800', utilization: 107 },
  { key: '4', project: 'Vertex Inventory System', budget: '$54,000', cost: '$21,600', utilization: 40 },
];

const utilizationColor = (pct: number) => {
  if (pct > 100) return '#ff4d4f';
  if (pct > 80) return '#faad14';
  return '#52c41a';
};

const columns = [
  { title: 'Project', dataIndex: 'project' },
  { title: 'Budget', dataIndex: 'budget' },
  { title: 'Cost to Date', dataIndex: 'cost' },
  {
    title: 'Utilization',
    dataIndex: 'utilization',
    render: (pct: number) => (
      <Flex align="center" gap={8}>
        <Progress
          percent={Math.min(pct, 100)}
          size="small"
          showInfo={false}
          strokeColor={utilizationColor(pct)}
          style={{ width: 90 }}
        />
        <Text style={{ color: utilizationColor(pct) }}>{pct}%</Text>
      </Flex>
    ),
  },
];

const FinancePreviewMockup: React.FC = () => (
  <Flex vertical gap={24}>
    <Row gutter={16}>
      <Col xs={12} md={6}>
        <Card>
          <Statistic title="Total Revenue" value={189000} prefix={<DollarOutlined />} />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card>
          <Statistic title="Total Cost" value={132600} prefix={<CalculatorOutlined />} />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card>
          <Statistic
            title="Profit Margin"
            value={29.8}
            suffix="%"
            prefix={<ArrowUpOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Card>
      </Col>
      <Col xs={12} md={6}>
        <Card>
          <Statistic title="Active Projects" value={4} prefix={<ProjectOutlined />} />
        </Card>
      </Col>
    </Row>

    <Card title="Project Profitability">
      <Table columns={columns} dataSource={FAKE_PROJECTS} pagination={false} size="middle" />
    </Card>
  </Flex>
);

export default FinancePreviewMockup;
