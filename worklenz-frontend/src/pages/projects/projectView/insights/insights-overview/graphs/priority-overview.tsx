import { Bar } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { ChartOptions } from 'chart.js';
import { Flex } from '@/shared/antd-imports';
import { ITaskPriorityCounts } from '@/types/project/project-insights.types';
import { useCallback, useEffect, useState } from 'react';
import { projectInsightsApiService } from '@/api/projects/insights/project-insights.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { Spin } from 'antd/lib';

Chart.register(ArcElement, Tooltip, CategoryScale, LinearScale, BarElement);

const priorityNameMap: Record<string, string> = {
  Low: 'priorityChart.low',
  Medium: 'priorityChart.medium',
  High: 'priorityChart.high',
  Critical: 'priorityChart.critical',
};

const PriorityOverview = () => {
  const { includeArchivedTasks, projectId } = useAppSelector(state => state.projectInsightsReducer);
  const { t } = useTranslation('project-view-insights');

  const [stats, setStats] = useState<ITaskPriorityCounts[]>([]);
  const [loading, setLoading] = useState(false);
  const { refreshTimestamp } = useAppSelector(state => state.projectReducer);

  const getTaskPriorityCounts = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const res = await projectInsightsApiService.getPriorityOverview(
        projectId,
        includeArchivedTasks
      );
      if (res.done) {
        setStats(res.body);
      }
    } catch (error) {
      console.error('Error fetching task priority counts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getTaskPriorityCounts();
  }, [projectId, includeArchivedTasks, refreshTimestamp]);

  const translatePriorityName = useCallback(
    (name: string | undefined): string => {
      if (!name) return t('priorityChart.noPriority', { defaultValue: 'No Priority' });
      const key = priorityNameMap[name];
      if (key) return t(key, { defaultValue: name });
      return name;
    },
    [t]
  );

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: {
          display: true,
          text: t('priorityChart.priorityAxis', { defaultValue: 'Priority' }),
          align: 'end',
        },
        grid: {
          color: 'rgba(200, 200, 200, 0.5)',
        },
      },
      y: {
        title: {
          display: true,
          text: t('priorityChart.taskCountAxis', { defaultValue: 'Task Count' }),
          align: 'end',
        },
        grid: {
          color: 'rgba(200, 200, 200, 0.5)',
        },
        beginAtZero: true,
      },
    },
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

  const data = {
    labels: stats.map(stat => translatePriorityName(stat.name)),
    datasets: [
      {
        label: t('priorityChart.tasks', { defaultValue: 'Tasks' }),
        data: stats.map(stat => {
          // Handle case where data might be an array or contain null
          if (Array.isArray(stat.data)) {
            return stat.data.filter(d => d !== null)[0] || 0;
          }
          return stat.data || 0;
        }),
        backgroundColor: stats.map(stat => stat.color),
      },
    ],
  };

  const mockPriorityData = {
    labels: [t('priorityChart.low', { defaultValue: 'Low' }), t('priorityChart.medium', { defaultValue: 'Medium' }), t('priorityChart.high', { defaultValue: 'High' })],
    datasets: [
      {
        label: t('priorityChart.tasks', { defaultValue: 'Tasks' }),
        data: [6, 12, 2],
        backgroundColor: ['#75c997', '#fbc84c', '#f37070'],
        hoverBackgroundColor: ['#46d980', '#ffc227', '#ff4141'],
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
    <Flex justify="center">
      {loading && <Spin />}
      <Bar options={options} data={data} className="h-[350px] w-full md:max-w-[580px]" />
    </Flex>
  );
};

export default PriorityOverview;
