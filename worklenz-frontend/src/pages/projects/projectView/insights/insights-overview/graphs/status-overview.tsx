import React, { useEffect, useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement } from 'chart.js';
import { Badge, Flex, Tooltip, Typography, Spin } from '@/shared/antd-imports';
import { ChartOptions } from 'chart.js';
import { projectInsightsApiService } from '@/api/projects/insights/project-insights.api.service';
import { ITaskStatusCounts } from '@/types/project/project-insights.types';
import { useAppSelector } from '@/hooks/useAppSelector';

Chart.register(ArcElement);

const StatusOverview = () => {
  const { includeArchivedTasks, projectId } = useAppSelector(state => state.projectInsightsReducer);

  const [stats, setStats] = useState<ITaskStatusCounts[]>([]);
  const [loading, setLoading] = useState(false);
  const { refreshTimestamp } = useAppSelector(state => state.projectReducer);

  const getTaskStatusCounts = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const res = await projectInsightsApiService.getTaskStatusCounts(
        projectId,
        includeArchivedTasks
      );
      if (res.done) {
        setStats(res.body);
      }
    } catch (error) {
      console.error('Error fetching task status counts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getTaskStatusCounts();
  }, [projectId, includeArchivedTasks, refreshTimestamp]);

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

  const data = {
    labels: stats.map(status => status.name),
    datasets: [
      {
        label: 'Tasks',
        data: stats.map(status => status.y),
        backgroundColor: stats.map(status => status.color),
        hoverBackgroundColor: stats.map(status => status.color + '90'),
        borderWidth: 1,
      },
    ],
  };

  if (loading) {
    return (
      <Flex justify="center" align="center" style={{ height: 350 }}>
        <Spin size="large" />
      </Flex>
    );
  }

  return (
    <Flex gap={24} wrap="wrap-reverse" justify="center">
      {loading && <Spin />}
      <div style={{ position: 'relative', height: 350, width: '100%', maxWidth: 350 }}>
        <Doughnut options={options} data={data} />
      </div>

      <Flex gap={12} style={{ marginBlockStart: 12 }} wrap="wrap" className="flex-row xl:flex-col">
        {stats.map(status => (
          <Flex key={status.name} gap={8} align="center">
            <Badge color={status.color} />
            <Typography.Text>
              {status.name}
              <span style={{ marginLeft: 4 }}>({status.y})</span>
            </Typography.Text>
          </Flex>
        ))}
      </Flex>
    </Flex>
  );
};

export default StatusOverview;
