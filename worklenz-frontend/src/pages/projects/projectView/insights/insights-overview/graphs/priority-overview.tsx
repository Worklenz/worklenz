import { Bar } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { ChartOptions } from 'chart.js';
import { Flex } from '@/shared/antd-imports';
import { ITaskPriorityCounts } from '@/types/project/project-insights.types';
import { useEffect, useState } from 'react';
import { projectInsightsApiService } from '@/api/projects/insights/project-insights.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';
import { Spin } from 'antd/lib';

Chart.register(ArcElement, Tooltip, CategoryScale, LinearScale, BarElement);

const PriorityOverview = () => {
  const { includeArchivedTasks, projectId } = useAppSelector(state => state.projectInsightsReducer);

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

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        title: {
          display: true,
          text: 'Priority',
          align: 'end',
        },
        grid: {
          color: 'rgba(200, 200, 200, 0.5)',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Task Count',
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
    labels: stats.map(stat => stat.name),
    datasets: [
      {
        label: 'Tasks',
        data: stats.map(stat => stat.data),
        backgroundColor: stats.map(stat => stat.color),
      },
    ],
  };

  const mockPriorityData = {
    labels: ['Low', 'Medium', 'High'],
    datasets: [
      {
        label: 'Tasks',
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
