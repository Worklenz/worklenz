import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar } from 'react-chartjs-2';
import {
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  Tooltip as ChartTooltip,
} from 'chart.js';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  Progress,
  Row,
  Table,
  Tag,
  Tooltip,
  Typography,
  theme,
} from '@/shared/antd-imports';
import type { ColumnsType } from 'antd/es/table';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import {
  financeOverviewApiService,
  IFinanceProfitabilityProject,
  IFinanceProfitabilityResponse,
} from '@/api/finance-overview/finance-overview.api.service';
import { FinanceKpiCard } from './FinanceKpiCard';
import { alertColor, burnColor, fmtMoney } from './finance-report-utils';
import { useFinanceReportFetch } from './useFinanceReportFetch';

Chart.register(CategoryScale, LinearScale, BarElement, ChartTooltip, Legend);

const { Text, Title } = Typography;

const EMPTY_SUMMARY: IFinanceProfitabilityResponse['summary'] = {
  revenue: 0,
  invoiced_revenue: 0,
  tracked_cost: 0,
  profit: 0,
  profit_margin_pct: 0,
  billable_utilization_pct: 0,
  has_revenue: false,
};

export const FinanceProfitabilityPage = () => {
  const { t } = useTranslation('finance-reports');
  const { token } = theme.useToken();
  useDocumentTitle(t('profitability.pageTitle', { defaultValue: 'Profitability' }));

  const { data, loading, error, refetch } = useFinanceReportFetch(
    () => financeOverviewApiService.getProfitability(),
    []
  );

  const summary = data?.summary ?? EMPTY_SUMMARY;
  const projects = data?.projects ?? [];
  const trend = data?.trend ?? [];
  const breakdown = data?.cost_breakdown ?? [];
  const breakdownTotal = breakdown.reduce((sum, item) => sum + item.amount, 0) || 1;

  const chartData = useMemo(
    () => ({
      labels: trend.map(point => point.month_label),
      datasets: [
        {
          label: t('profitability.legend.revenue', { defaultValue: 'Revenue' }),
          data: trend.map(point => point.revenue),
          backgroundColor: '#1677ff88',
          borderRadius: 4,
        },
        {
          label: t('profitability.legend.profit', { defaultValue: 'Profit' }),
          data: trend.map(point => point.profit),
          backgroundColor: '#52c41a88',
          borderRadius: 4,
        },
        {
          label: t('profitability.legend.cost', { defaultValue: 'Cost' }),
          data: trend.map(point => point.cost),
          backgroundColor: '#faad1488',
          borderRadius: 4,
        },
      ],
    }),
    [t, trend]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: token.colorTextSecondary } } },
      scales: {
        x: { ticks: { color: token.colorTextSecondary }, grid: { display: false } },
        y: { ticks: { color: token.colorTextSecondary }, grid: { color: token.colorBorderSecondary } },
      },
    }),
    [token.colorBorderSecondary, token.colorTextSecondary]
  );

  const columns: ColumnsType<IFinanceProfitabilityProject> = useMemo(
    () => [
      {
        title: t('profitability.table.project', { defaultValue: 'Project' }),
        dataIndex: 'name',
        key: 'name',
        render: (name: string, record) => (
          <Flex align="center" gap={8}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: record.color_code,
                flexShrink: 0,
                display: 'inline-block',
              }}
            />
            <Tooltip title={name}>
              <Text ellipsis style={{ maxWidth: 220 }}>
                {name}
              </Text>
            </Tooltip>
          </Flex>
        ),
      },
      {
        title: t('profitability.table.cost', { defaultValue: 'Cost' }),
        dataIndex: 'cost',
        key: 'cost',
        render: (value: number, record) => <Text strong>{fmtMoney(value, record.currency)}</Text>,
      },
      {
        title: t('profitability.table.utilization', { defaultValue: 'Utilization' }),
        dataIndex: 'utilization_pct',
        key: 'utilization_pct',
        width: 180,
        render: (pct: number) => (
          <Flex align="center" gap={8}>
            <Progress
              percent={Math.min(pct, 100)}
              showInfo={false}
              strokeColor={burnColor(pct)}
              size="small"
              style={{ flex: 1, margin: 0 }}
            />
            <Text style={{ fontSize: 12 }}>{pct}%</Text>
          </Flex>
        ),
      },
      {
        title: t('profitability.table.health', { defaultValue: 'Health' }),
        dataIndex: 'health',
        key: 'health',
        render: (health: IFinanceProfitabilityProject['health']) => (
          <Tag color={alertColor(health)}>
            {t(`profitability.health.${health}`, { defaultValue: health })}
          </Tag>
        ),
      },
    ],
    [t]
  );

  return (
    <Flex vertical gap={16}>
      <div>
        <Title level={4} style={{ margin: 0 }}>
          {t('profitability.pageTitle', { defaultValue: 'Profitability' })}
        </Title>
        <Text type="secondary" style={{ fontSize: 13, marginTop: 2, display: 'block' }}>
          {t('profitability.pageSubTitle', {
            defaultValue: 'Portfolio revenue from paid invoices and tracked cost by project.',
          })}
        </Text>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message={t('loadError', { defaultValue: 'Could not load this report. Try again.' })}
          action={
            <Button size="small" onClick={refetch}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      )}

      <Alert
        type="info"
        showIcon
        message={
          summary.has_revenue
            ? t('profitability.revenueNote', {
                defaultValue:
                  'Revenue is paid client-portal invoices. Project-level revenue is not tracked yet.',
              })
            : t('profitability.noRevenueNote', {
                defaultValue: 'No paid invoices yet, so revenue, profit, and margin stay empty.',
              })
        }
      />

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={5}>
          <FinanceKpiCard
            title={t('profitability.kpi.revenue', { defaultValue: 'Revenue' })}
            value={fmtMoney(summary.revenue)}
            valueColor="#52c41a"
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <FinanceKpiCard
            title={t('profitability.kpi.trackedCost', { defaultValue: 'Tracked Cost' })}
            value={fmtMoney(summary.tracked_cost)}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <FinanceKpiCard
            title={t('profitability.kpi.profit', { defaultValue: 'Profit' })}
            value={fmtMoney(summary.profit)}
            valueColor={summary.profit < 0 ? '#ff4d4f' : '#1677ff'}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <FinanceKpiCard
            title={t('profitability.kpi.margin', { defaultValue: 'Profit Margin' })}
            value={`${summary.profit_margin_pct}%`}
            loading={loading}
          />
        </Col>
        <Col xs={24} sm={12} lg={5}>
          <FinanceKpiCard
            title={t('profitability.kpi.billableUtil', { defaultValue: 'Billable Util.' })}
            value={`${summary.billable_utilization_pct}%`}
            valueColor="#722ed1"
            loading={loading}
          />
        </Col>
      </Row>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={14}>
          <Card title={t('profitability.trendTitle', { defaultValue: 'Revenue & Profit Trend' })}>
            <div style={{ height: 220 }}>
              {trend.length ? (
                <Bar data={chartData} options={chartOptions} />
              ) : (
                <Empty description={t('profitability.empty', { defaultValue: 'No projects to show yet.' })} />
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={t('profitability.costBreakdownTitle', { defaultValue: 'Cost Breakdown' })}>
            {breakdown.map(item => (
              <div key={item.key} style={{ marginBottom: 12 }}>
                <Flex justify="space-between" style={{ marginBottom: 4 }}>
                  <Text>
                    {t(`profitability.cost.${item.key}`, { defaultValue: item.key })}
                  </Text>
                  <Text type="secondary">
                    {fmtMoney(item.amount)} — {Math.round((item.amount / breakdownTotal) * 100)}%
                  </Text>
                </Flex>
                <Progress
                  percent={Math.round((item.amount / breakdownTotal) * 100)}
                  showInfo={false}
                  strokeColor={item.key === 'fixed' ? '#1677ff' : '#52c41a'}
                  size="small"
                />
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      <Card
        title={t('profitability.tableTitle', { defaultValue: 'Project Profitability' })}
        styles={{ body: { padding: 0 } }}
      >
        <Table<IFinanceProfitabilityProject>
          rowKey="id"
          columns={columns}
          dataSource={projects}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }}
          locale={{
            emptyText: (
              <Empty
                description={t('profitability.empty', { defaultValue: 'No projects to show yet.' })}
              />
            ),
          }}
          scroll={{ x: 700 }}
        />
      </Card>
    </Flex>
  );
};

export default FinanceProfitabilityPage;
