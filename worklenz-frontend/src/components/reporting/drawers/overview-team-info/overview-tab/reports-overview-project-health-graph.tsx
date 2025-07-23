import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, ChartOptions } from 'chart.js';
import { Badge, Card, Flex, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  IRPTOverviewTeamByHealth,
  IRPTOverviewTeamChartData,
} from '@/types/reporting/reporting.types';
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
          label: context => {
            const value = context.raw as number;
            return `${context.label}: ${value} task${value !== 1 ? 's' : ''}`;
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
      <div className="flex flex-wrap items-center justify-center gap-6 xl:flex-nowrap">
        <Doughnut
          data={chartData}
          options={options}
          className="max-h-[200px] w-full max-w-[200px]"
        />

        <div className="flex flex-row flex-wrap gap-3 xl:flex-col">
          {/* total tasks */}
          <Flex gap={4} align="center">
            <Badge color="#a9a9a9" />
            <Typography.Text ellipsis>
              {t('allText')} ({data?.all})
            </Typography.Text>
          </Flex>

          {/* health-specific tasks */}
          {healthGraphItems.map(item => (
            <Flex key={item.name} gap={4} align="center">
              <Badge color={item.color} />
              <Typography.Text ellipsis>
                {t(`${item.name}Text`)} ({item.count})
              </Typography.Text>
            </Flex>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default OverviewReportsProjectHealthGraph;
