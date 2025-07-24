import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip } from 'chart.js';
import { Badge, Card, Flex, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { IRPTOverviewMemberChartData } from '@/types/reporting/reporting.types';

Chart.register(ArcElement, Tooltip);

interface MembersReportsStatusGraphProps {
  model: IRPTOverviewMemberChartData | undefined;
  loading: boolean;
}

const MembersReportsStatusGraph = ({ model, loading }: MembersReportsStatusGraphProps) => {
  // localization
  const { t } = useTranslation('reporting-members-drawer');

  // chart data
  const chartData = {
    labels: model?.chart.map(item => t(`${item.name}Text`)),
    datasets: [
      {
        label: t('tasksText'),
        data: model?.chart.map(item => item.y),
        backgroundColor: model?.chart.map(item => item.color),
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
        position: 'top' as const,
      },
      datalabels: {
        display: false,
      },
    },
  };

  return (
    <Card
      loading={loading}
      title={
        <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
          {t('tasksByStatusText')}
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
            <Badge color="#000" />
            <Typography.Text ellipsis>
              {t('allText')} ({model?.total})
            </Typography.Text>
          </Flex>

          {/* status-specific tasks */}
          {model?.chart.map(item => (
            <Flex key={item.name} gap={4} align="center">
              <Badge color={item.color} />
              <Typography.Text ellipsis>
                {t(`${item.name}`)}({item.y})
              </Typography.Text>
            </Flex>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default MembersReportsStatusGraph;
