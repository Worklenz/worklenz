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
  Row,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import {
  financeOverviewApiService,
  IFinanceForecastsResponse,
} from '@/api/finance-overview/finance-overview.api.service';
import { fmtMoney } from './finance-report-utils';
import { useFinanceReportFetch } from './useFinanceReportFetch';

Chart.register(CategoryScale, LinearScale, BarElement, ChartTooltip, Legend);

const { Text, Title } = Typography;

const EMPTY_SUMMARY: IFinanceForecastsResponse['summary'] = {
  projected_revenue: 0,
  projected_profit: 0,
  revenue_delta_pct: null,
  profit_delta_pct: null,
  has_revenue: false,
};

export const FinanceForecastsPage = () => {
  const { t } = useTranslation('finance-reports');
  const { token } = theme.useToken();
  useDocumentTitle(t('forecasts.pageTitle', { defaultValue: 'Forecasts' }));

  const { data, loading, error, refetch } = useFinanceReportFetch(
    () => financeOverviewApiService.getForecasts(),
    []
  );

  const summary = data?.summary ?? EMPTY_SUMMARY;
  const chart = data?.chart ?? [];
  const formatDelta = (value: number) => `${value > 0 ? '+' : ''}${value}`;
  const hasDelta = (value: number | null): value is number => value !== null;

  const chartData = useMemo(
    () => ({
      labels: chart.map(point => point.month_label),
      datasets: [
        {
          label: t('forecasts.legend.revenue', { defaultValue: 'Revenue' }),
          data: chart.map(point => point.revenue),
          backgroundColor: chart.map(point => (point.projected ? '#1677ff55' : '#1677ff')),
          borderRadius: 4,
        },
        {
          label: t('forecasts.legend.profit', { defaultValue: 'Profit' }),
          data: chart.map(point => point.profit),
          backgroundColor: chart.map(point => (point.projected ? '#52c41a55' : '#52c41a')),
          borderRadius: 4,
        },
      ],
    }),
    [chart, t]
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

  return (
    <Flex vertical gap={16}>
      <div>
        <Title level={4} style={{ margin: 0 }}>
          {t('forecasts.pageTitle', { defaultValue: 'Forecasts' })}
        </Title>
        <Text type="secondary" style={{ fontSize: 13, marginTop: 2, display: 'block' }}>
          {t('forecasts.pageSubTitle', {
            defaultValue: 'Next three months from a linear trend of recent invoiced revenue and cost.',
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
        message={t('forecasts.methodology', {
          defaultValue:
            'Forecast method: linear trend of the previous three months. Not a pipeline-based forecast.',
        })}
      />

      <Row gutter={[12, 12]}>
        <Col xs={24} md={12}>
          <Card loading={loading}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('forecasts.kpi.projectedRevenue', {
                defaultValue: 'Projected Revenue (Next Month)',
              })}
            </Text>
            <div style={{ fontSize: 28, fontWeight: 600, color: '#52c41a', marginTop: 4 }}>
              {fmtMoney(summary.projected_revenue)}
            </div>
            {hasDelta(summary.revenue_delta_pct) ? (
              <Text style={{ color: summary.revenue_delta_pct >= 0 ? '#52c41a' : '#ff4d4f' }}>
                {t('forecasts.vsPrevious', {
                  defaultValue: '{{value}}% vs this month',
                  value: formatDelta(summary.revenue_delta_pct),
                })}
              </Text>
            ) : (
              <Text type="secondary">
                {t('forecasts.noRevenueBaseline', { defaultValue: 'No revenue this month to compare' })}
              </Text>
            )}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card loading={loading}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('forecasts.kpi.projectedProfit', {
                defaultValue: 'Projected Profit (Next Month)',
              })}
            </Text>
            <div style={{ fontSize: 28, fontWeight: 600, color: '#1677ff', marginTop: 4 }}>
              {fmtMoney(summary.projected_profit)}
            </div>
            {hasDelta(summary.profit_delta_pct) ? (
              <Text style={{ color: summary.profit_delta_pct >= 0 ? '#52c41a' : '#ff4d4f' }}>
                {t('forecasts.vsPrevious', {
                  defaultValue: '{{value}}% vs this month',
                  value: formatDelta(summary.profit_delta_pct),
                })}
              </Text>
            ) : (
              <Text type="secondary">
                {t('forecasts.noProfitBaseline', { defaultValue: 'No profit this month to compare' })}
              </Text>
            )}
          </Card>
        </Col>
      </Row>

      <Card title={t('forecasts.chartTitle', { defaultValue: '3-Month Revenue Forecast' })}>
        <div style={{ height: 240 }}>
          {chart.length ? (
            <Bar data={chartData} options={chartOptions} />
          ) : (
            <Empty
              description={t('forecasts.empty', {
                defaultValue: 'Not enough history to forecast yet.',
              })}
            />
          )}
        </div>
      </Card>
    </Flex>
  );
};

export default FinanceForecastsPage;
