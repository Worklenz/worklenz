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

  const totalTasks = statusGraphItems.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card
      title={
        <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
          {t('projectsByStatusText')}
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
            <Typography.Text ellipsis={{ tooltip: `${t('allText')} (${totalTasks})` }} className="min-w-0 flex-1">
              {t('allText')} ({totalTasks})
            </Typography.Text>
          </Flex>

          {/* status-specific tasks — scrollable after 10 items */}
          <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
            <div className="flex flex-col gap-2">
              {statusGraphItems.map(item => (
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

export default OverviewReportsProjectStatusGraph;
