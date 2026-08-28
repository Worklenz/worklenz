import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Col,
  Row,
  Statistic,
  Table,
  Progress,
  Flex,
  Typography,
  DashboardOutlined,
  TeamOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@/shared/antd-imports';

const { Text } = Typography;

// Fake team-member names below stand in for real (untranslated) user data.
const FAKE_MEMBERS = [
  { key: '1', name: 'Amara Okafor', utilization: 92 },
  { key: '2', name: 'Daniel Reyes', utilization: 108 },
  { key: '3', name: 'Priya Nair', utilization: 76 },
  { key: '4', name: 'Liam Carter', utilization: 54 },
];

const utilizationColor = (pct: number) => {
  if (pct > 100) return '#ff4d4f';
  if (pct > 80) return '#52c41a';
  return '#faad14';
};

const UtilizationPreviewMockup: React.FC = () => {
  const { t } = useTranslation(['upgrade-preview', 'schedule']);
  const tp = (key: string, defaultValue: string) => t(`financeMockups.utilization.${key}`, { defaultValue, ns: 'upgrade-preview' });

  const columns = [
    { title: tp('teamMemberColumn', 'Team Member'), dataIndex: 'name' },
    {
      title: t('utilization', { ns: 'schedule', defaultValue: 'Utilization' }),
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

  return (
    <Flex vertical gap={24}>
      <Row gutter={16}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title={tp('avgUtilization', 'Avg. Utilization')} value={82} suffix="%" prefix={<DashboardOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title={tp('teamSize', 'Team Size')} value={12} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={tp('overutilized', 'Overutilized')}
              value={3}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title={tp('underutilized', 'Underutilized')}
              value={2}
              valueStyle={{ color: '#faad14' }}
              prefix={<ArrowDownOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card title={tp('byTeamMemberCard', 'Utilization by Team Member')}>
        <Table columns={columns} dataSource={FAKE_MEMBERS} pagination={false} size="middle" />
      </Card>
    </Flex>
  );
};

export default UtilizationPreviewMockup;
