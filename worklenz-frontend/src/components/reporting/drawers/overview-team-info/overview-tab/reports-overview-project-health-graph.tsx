import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, ChartOptions } from 'chart.js';
import { Badge, Card, Flex, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { IRPTOverviewTeamByHealth } from '@/types/reporting/reporting.types';
import { ALPHA_CHANNEL } from '@/shared/constants';

Chart.register(ArcElement, Tooltip);

const OverviewReportsProjectHealthGraph = ({
  data,
}: {
  data: IRPTOverviewTeamByHealth | undefined;
}) => {
  const { t } = useTranslation('reporting-overview-drawer');

  type HealthGraphItemType = {

    name: string;
    color: string;
    count: number;
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      datalabels: {
        display: false,
      },
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: contexts => {
            const label = contexts[0]?.label ?? '';
            return t(`${label}Text`);
          },
          label: context => {
            const value = context.raw as number;
            const translatedLabel = t(`${context.label}Text`);
            return `${translatedLabel}: ${value} project${value !== 1 ? 's' : ''}`;
          },
        },
      },
    },
  };

  // mock data
  const healthGraphItems: HealthGraphItemType[] = [
    { name: 'notSet', color: '#a9a9a9', count: data?.not_set ?? 0 },
    { name: 'needsAttention', color: '#f37070', count: data?.needs_attention ?? 0 },
    { name: 'atRisk', color: '#fbc84c', count: data?.at_risk ?? 0 },
    { name: 'good', color: '#75c997', count: data?.good ?? 0 },
  ];

  const totalProjects = healthGraphItems.reduce((sum, item) => sum + item.count, 0);

  const chartData = {
    labels: healthGraphItems.map(item => item.name),
    datasets: [
      {
        data: healthGraphItems.map(item => item.count),
        backgroundColor: healthGraphItems.map(item => item.color + ALPHA_CHANNEL),
      },
    ],
  };

  return (
    <Card
      title={
        <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
          {t('projectsByHealthText')}
        </Typography.Text>
      }
    >
      <div className="flex items-start gap-6">
        <div className="shrink-0" style={{ width: 160, height: 160 }}>
          <Doughnut
            data={chartData}
            options={options}
            style={{ width: 160, height: 160 }}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden">
          {/* total tasks */}
          <Flex gap={4} align="center" className="min-w-0">
            <Badge color="#a9a9a9" className="shrink-0" />
            <Typography.Text ellipsis={{ tooltip: `${t('allText')} (${totalProjects})` }} className="min-w-0 flex-1">
              {t('allText')} ({totalProjects})
            </Typography.Text>
          </Flex>

          {/* health-specific tasks — scrollable after 10 items */}
          <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
            <div className="flex flex-col gap-2">
              {healthGraphItems.map(item => (
                <Flex key={item.name} gap={4} align="center" className="min-w-0">
                  <Badge color={item.color} className="shrink-0" />
                  <Typography.Text ellipsis={{ tooltip: `${t(`${item.name}Text`)} (${item.count})` }} className="min-w-0 flex-1">
                    {t(`${item.name}Text`)} ({item.count})
                  </Typography.Text>
                </Flex>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default OverviewReportsProjectHealthGraph;
