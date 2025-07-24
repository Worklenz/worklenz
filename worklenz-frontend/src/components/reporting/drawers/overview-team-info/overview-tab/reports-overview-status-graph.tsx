import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, ChartOptions } from 'chart.js';
import { Badge, Card, Flex, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { IRPTOverviewTeamByStatus, IRPTOverviewTeamInfo } from '@/types/reporting/reporting.types';
import { ALPHA_CHANNEL } from '@/shared/constants';

Chart.register(ArcElement, Tooltip);

const OverviewReportsProjectStatusGraph = ({
  data,
}: {
  data: IRPTOverviewTeamByStatus | undefined;
}) => {
  const { t } = useTranslation('reporting-overview-drawer');

  type StatusGraphItemType = {
    name: string;
    color: string;
    count: number;
  };

  const statusGraphItems: StatusGraphItemType[] = [
    { name: 'inProgress', color: '#80ca79', count: data?.in_progress ?? 0 },
    { name: 'inPlanning', color: '#cbc8a1', count: data?.in_planning ?? 0 },
    { name: 'completed', color: '#80ca79', count: data?.completed ?? 0 },
    { name: 'proposed', color: '#cbc8a1', count: data?.proposed ?? 0 },
    { name: 'onHold', color: '#cbc8a1', count: data?.on_hold ?? 0 },
    { name: 'blocked', color: '#cbc8a1', count: data?.blocked ?? 0 },
    { name: 'cancelled', color: '#f37070', count: data?.cancelled ?? 0 },
  ];

  const chartData = {
    labels: statusGraphItems.map(item => item.name),
    datasets: [
      {
        data: statusGraphItems.map(item => item.count),
        backgroundColor: statusGraphItems.map(item => item.color + ALPHA_CHANNEL),
      },
    ],
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

  const totalTasks = statusGraphItems.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card
      title={
        <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
          {t('projectsByStatusText')}
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

          {/* status-specific tasks */}
          {statusGraphItems.map(item => (
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

export default OverviewReportsProjectStatusGraph;
