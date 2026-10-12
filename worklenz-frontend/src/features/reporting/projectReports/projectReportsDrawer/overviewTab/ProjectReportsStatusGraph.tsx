import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip } from 'chart.js';
import { Badge, Card, Flex, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { IRPTOverviewProjectTasksByStatus } from '@/types/reporting/reporting.types';

Chart.register(ArcElement, Tooltip);

const ProjectReportsStatusGraph = ({
  values,
  loading,
}: {
  values: IRPTOverviewProjectTasksByStatus;
  loading: boolean;
}) => {
  const { t } = useTranslation('reporting-projects-drawer');

  const getStatusLabel = (name: string): string => {
    switch (name.trim().toLowerCase()) {
      case 'todo':
        return t('todoText', { defaultValue: 'To Do' });
      case 'doing':
        return t('doingText', { defaultValue: 'Doing' });
      case 'done':
        return t('doneText', { defaultValue: 'Done' });
      default:
        return t(`${name.toLowerCase()}Text`, { defaultValue: name });
    }
  };

  const chartData = {
    labels: values.chart.map(item => getStatusLabel(item.name)),
    datasets: [
      {
        label: t('tasksText', { defaultValue: 'Tasks' }),
        data: values.chart.map(item => item.y),
        backgroundColor: values.chart.map(item => item.color),
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
          {t('tasksByStatusText', { defaultValue: 'Tasks By Status' })}
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
              {t('allText', { defaultValue: 'All' })} ({values.all})
            </Typography.Text>
          </Flex>

          {/* status-specific tasks */}
          {values.chart.map(item => (
            <Flex key={item.name} gap={4} align="center">
              <Badge color={item.color} />
              <Typography.Text ellipsis>
                {getStatusLabel(item.name)} ({item.y})
              </Typography.Text>
            </Flex>
          ))}
        </div>
      </div>
    </Card>
  );
};

export default ProjectReportsStatusGraph;
