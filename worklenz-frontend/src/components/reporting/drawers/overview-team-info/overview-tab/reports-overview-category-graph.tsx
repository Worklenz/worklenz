import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, ChartOptions } from 'chart.js';
import { Badge, Card, Flex, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { IRPTOverviewTeamChartData } from '@/types/reporting/reporting.types';

Chart.register(ArcElement, Tooltip);

const OverviewReportsProjectCategoryGraph = ({
  data,
}: {
  data: IRPTOverviewTeamChartData | undefined;
}) => {
  // localization
  const { t } = useTranslation('reporting-overview-drawer');

  type CategoryGraphItemType = {
    name: string;
    color: string;
    count: number;
  };

  // mock data
  const categoryGraphItems: CategoryGraphItemType[] =
    data?.data.map(category => ({
      name: category.label,
      color: category.color,
      count: category.count,
    })) ?? [];

  // chart data
  const chartData = {
    labels: categoryGraphItems.map(item => item.name),
    datasets: [
      {
        label: t('projectsText'),
        data: categoryGraphItems.map(item => item.count),
        backgroundColor: categoryGraphItems.map(item => item.color),
      },
    ],
  };

  const totalTasks = categoryGraphItems.reduce((sum, item) => sum + item.count, 0);

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

  return (
    <Card
      title={
        <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
          {t('projectsByCategoryText')}
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

          {/* category-specific tasks — scrollable after 10 items */}
          <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
            <div className="flex flex-col gap-2">
              {categoryGraphItems.map(item => (
                <Flex key={item.name} gap={4} align="center" className="min-w-0">
                  <Badge color={item.color} className="shrink-0" />
                  <Typography.Text ellipsis={{ tooltip: `${item.name} (${item.count})` }} className="min-w-0 flex-1">
                    {item.name} ({item.count})
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

export default OverviewReportsProjectCategoryGraph;
