import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Row,
  Col,
  Flex,
  Typography,
  Statistic,
  Table,
  Tag,
  Button,
  Input,
  theme,
  SearchOutlined,
  DownloadOutlined,
  InfoCircleOutlined,
  MailOutlined,
} from '@/shared/antd-imports';

const { useToken } = theme;
const { Title, Text } = Typography;

interface ProjectRow {
  color: string;
  project: string;
  client: string;
  budget: string;
  cost: string;
  variance: string;
  variancePositive?: boolean;
  util: string;
  hours: string;
}

// Fake project/client names and figures below stand in for real (untranslated)
// user data — only the surrounding UI chrome (labels, headers) is translated.
const PROJECTS: ProjectRow[] = [
  { color: '#ff4d4f', project: 'Nimbus Retail Website', client: 'Nimbus Retail Co.', budget: '$42,000', cost: '$31,900', variance: '+$10,100', variancePositive: true, util: '76%', hours: '312h' },
  { color: '#faad14', project: 'Beacon Logistics App', client: 'Beacon Logistics', budget: '$68,000', cost: '$52,300', variance: '+$15,700', variancePositive: true, util: '77%', hours: '540h' },
  { color: '#1677ff', project: 'Solace Patient Portal', client: 'Solace Health Group', budget: '$25,000', cost: '$26,800', variance: '-$1,800', variancePositive: false, util: '107%', hours: '210h' },
  { color: '#52c41a', project: 'Vertex Inventory System', client: 'Vertex Manufacturing', budget: '$54,000', cost: '$21,600', variance: '+$32,400', variancePositive: true, util: '40%', hours: '188h' },
  { color: '#722ed1', project: 'Northwind Studio Refresh', client: 'Northwind Studio', budget: '__NO_BUDGET__', cost: '$0', variance: '—', util: '__NO_BUDGET__', hours: '0h' },
  { color: '#13c2c2', project: 'Mobile App Revamp', client: '—', budget: '__NO_BUDGET__', cost: '$4,200', variance: '—', util: '__NO_BUDGET__', hours: '96h' },
];

const STATUS_LEGEND_KEYS = [
  { color: '#52c41a', key: 'onTrack', count: '213' },
  { color: '#faad14', key: 'watch', count: '0' },
  { color: '#ff4d4f', key: 'overBudget', count: '0' },
] as const;

const FinanceOverviewPreviewMockup: React.FC = () => {
  const { token } = useToken();
  const { t } = useTranslation('finance-overview');
  const noBudgetSet = t('noBudgetSet', { defaultValue: 'No budget set' });

  const KPI_CARDS = [
    { title: t('kpiCard.totalManualBudget', { defaultValue: 'Total Manual Budget' }), value: '162,950', color: '#1677ff', info: true },
    { title: t('kpiCard.totalActualCost', { defaultValue: 'Total Actual Cost' }), value: '2,340', color: '#52c41a', info: true },
    { title: t('kpiCard.totalVariance', { defaultValue: 'Total Variance' }), value: '+ 160,610', color: '#52c41a', info: true },
    { title: t('kpiCard.budgetUtilization', { defaultValue: 'Budget Utilization' }), value: '1%', color: '#722ed1' },
    { title: t('kpiCard.estimatedHours', { defaultValue: 'Estimated Hours' }), value: '4,572 h' },
  ];

  const columns = [
    {
      title: t('table.project', { defaultValue: 'Project' }),
      dataIndex: 'project',
      render: (name: string, row: ProjectRow) => (
        <Flex align="center" gap={6}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
          <Text style={{ fontSize: 13 }}>{name}</Text>
        </Flex>
      ),
    },
    { title: t('table.client', { defaultValue: 'Client' }), dataIndex: 'client' },
    {
      title: t('table.manualBudget', { defaultValue: 'Manual Budget' }),
      dataIndex: 'budget',
      render: (v: string) => (v === '__NO_BUDGET__' ? noBudgetSet : v),
    },
    {
      title: t('table.actualCost', { defaultValue: 'Actual Cost' }),
      dataIndex: 'cost',
      render: (v: string) => <Text style={{ color: '#52c41a' }}>{v}</Text>,
    },
    {
      title: t('table.variance', { defaultValue: 'Variance' }),
      dataIndex: 'variance',
      render: (v: string, row: ProjectRow) => (
        <Text style={{ color: row.variancePositive === undefined ? undefined : row.variancePositive ? '#52c41a' : '#ff4d4f' }}>
          {v}
        </Text>
      ),
    },
    {
      title: t('table.budgetUtilization', { defaultValue: 'Budget Utilization' }),
      dataIndex: 'util',
      render: (v: string) => (v === '__NO_BUDGET__' ? noBudgetSet : v),
    },
    { title: t('table.estHours', { defaultValue: 'Est. Hours' }), dataIndex: 'hours' },
    {
      title: '',
      dataIndex: 'action',
      render: () => <Button size="small">{t('viewButton', { defaultValue: 'View' })}</Button>,
    },
  ];

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap={12}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {t('pageTitle', { defaultValue: 'Finance Overview' })}
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {t('pageSubTitle', {
              defaultValue:
                'Budget, actual cost, and variance rolled up across all projects. Click into a project for its full Finance tab.',
            })}
          </Text>
        </div>
        <Button type="primary" icon={<DownloadOutlined />}>
          {t('exportButton', { defaultValue: 'Export as Excel' })}
        </Button>
      </Flex>

      <Row gutter={[12, 12]}>
        {KPI_CARDS.map(kpi => (
          <Col key={kpi.title} xs={12} md={8} lg={5}>
            <Card size="small" style={{ height: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {kpi.title}
                {kpi.info && <InfoCircleOutlined style={{ marginLeft: 4, fontSize: 11, opacity: 0.6 }} />}
              </Text>
              <div style={{ fontSize: 20, fontWeight: 600, color: kpi.color }}>{kpi.value}</div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={17}>
          <Card
            title={t('tableCard.title', { defaultValue: 'Project Financial Health' })}
            extra={
              <Input
                placeholder={t('table.searchPlaceholder', { defaultValue: 'Search Projects' })}
                prefix={<SearchOutlined />}
                style={{ width: 200 }}
              />
            }
            styles={{ body: { padding: 0 } }}
          >
            <Table columns={columns} dataSource={PROJECTS} pagination={false} size="middle" rowKey="project" />
            <Flex
              justify="space-between"
              align="center"
              wrap="wrap"
              gap={8}
              style={{ padding: '10px 16px', borderTop: `1px solid ${token.colorBorderSecondary}` }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('paginationText', { ns: 'upgrade-preview', defaultValue: '{{from}}-{{to}} of {{total}}', from: 1, to: 10, total: 213 })}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('perPageText', { ns: 'upgrade-preview', defaultValue: '{{count}} / page', count: 10 })}
              </Text>
            </Flex>
          </Card>
        </Col>

        <Col xs={24} lg={7}>
          <Flex vertical gap={16}>
            <Card title={t('attention.title', { defaultValue: 'Projects Needing Attention' })}>
              <Flex vertical align="center" gap={8} style={{ padding: '16px 0' }}>
                <MailOutlined style={{ fontSize: 28, opacity: 0.35 }} />
                <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>
                  {t('attention.emptyState', { defaultValue: 'All projects are within budget.' })}
                </Text>
              </Flex>
            </Card>

            <Card title={t('distribution.title', { defaultValue: 'Budget Status Distribution' })}>
              <Flex vertical align="center" gap={16}>
                <div
                  style={{
                    width: 130,
                    height: 130,
                    borderRadius: '50%',
                    background: `conic-gradient(${token.colorSuccess} 0% 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 90,
                      height: 90,
                      borderRadius: '50%',
                      background: token.colorBgContainer,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text strong style={{ fontSize: 20 }}>
                      213
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {t('distribution.total', { defaultValue: 'Total' })}
                    </Text>
                  </div>
                </div>

                <Flex vertical gap={6} style={{ width: '100%' }}>
                  {STATUS_LEGEND_KEYS.map(item => (
                    <Flex key={item.key} justify="space-between" align="center" gap={8}>
                      <Flex align="center" gap={6}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                        <Text style={{ fontSize: 11 }}>{t(`distribution.${item.key}`)}</Text>
                      </Flex>
                      <Text type="secondary" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                        {item.count} {t('distribution.projects', { defaultValue: 'projects' })}
                      </Text>
                    </Flex>
                  ))}
                </Flex>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {t('distribution.breakdown', { defaultValue: 'Actual cost breakdown: {{fixed}} fixed · {{timeBased}} time-based', fixed: '2K', timeBased: 0 })}
                </Text>
              </Flex>
            </Card>
          </Flex>
        </Col>
      </Row>
    </Flex>
  );
};

export default FinanceOverviewPreviewMockup;
