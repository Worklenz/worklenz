import { useState, useMemo, useEffect } from 'react';
import { Flex, Select, Empty, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { IWorkloadData } from '@/types/workload/workload.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import { formatTime } from '@/api/project-workload/project-workload.api.service';
import { Bar } from 'react-chartjs-2';
import PillToggleGroup from './PillToggleGroup';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ChartOptions,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend);

// Helper function to calculate working days per week from organization settings
const calculateWorkingDaysFromOrgSettings = (workingDays: any): number => {
  if (!workingDays) return 5; // Default to 5 days if no working days data

  const days = {
    monday: workingDays.monday || false,
    tuesday: workingDays.tuesday || false,
    wednesday: workingDays.wednesday || false,
    thursday: workingDays.thursday || false,
    friday: workingDays.friday || false,
    saturday: workingDays.saturday || false,
    sunday: workingDays.sunday || false,
  };

  return Object.values(days).filter(Boolean).length;
};

// Helper function to calculate working days in a date range
const calculateWorkingDaysInPeriod = (
  startDate: string,
  endDate: string,
  workingDaysConfig: any
): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) return 0;

  const workingDays = workingDaysConfig || {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
  };

  // Map JS day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday) to working days config
  const dayMapping = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  let workingDaysCount = 0;
  let currentDate = new Date(start);

  // Include end date in calculation
  while (currentDate <= end) {
    const dayOfWeek = currentDate.getDay();
    const dayName = dayMapping[dayOfWeek];

    if (workingDays[dayName]) {
      workingDaysCount++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return workingDaysCount;
};

// Helper function to calculate workload from tasks for a specific date range
const calculateWorkloadFromTasks = (tasks: any[], startDate?: string, endDate?: string): number => {
  if (!Array.isArray(tasks)) return 0;

  let totalHours = 0;

  // Use provided date range or default to current/next month
  let startOfPeriod: Date;
  let endOfPeriod: Date;

  if (startDate && endDate) {
    startOfPeriod = new Date(startDate);
    endOfPeriod = new Date(endDate);
  } else {
    // Fallback to 2-month period
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    startOfPeriod = new Date(currentYear, currentMonth, 1);
    endOfPeriod = new Date(currentYear, currentMonth + 2, 0);
  }

  let activeTasks = 0;

  tasks.forEach(task => {
    if (task?.start_date && task?.end_date) {
      const startDate = new Date(task.start_date);
      const endDate = new Date(task.end_date);

      // Check if task overlaps with our period
      if (startDate <= endOfPeriod && endDate >= startOfPeriod) {
        activeTasks++;
        // Calculate overlap period
        const overlapStart = new Date(Math.max(startDate.getTime(), startOfPeriod.getTime()));
        const overlapEnd = new Date(Math.min(endDate.getTime(), endOfPeriod.getTime()));
        const overlapDays = Math.max(
          1,
          Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24))
        );

        // Estimate 3-6 hours per active task based on duration
        const baseHours = Math.min(6, Math.max(3, overlapDays * 0.5));
        totalHours += baseHours;
      }
    } else if (task?.end_date) {
      // Tasks with only end date
      const endDate = new Date(task.end_date);
      if (endDate >= startOfPeriod && endDate <= endOfPeriod) {
        activeTasks++;
        totalHours += 4; // Default 4 hours for tasks without start date
      }
    } else if (!task?.start_date && !task?.end_date) {
      // Tasks without dates - assume some workload if there are many
      activeTasks++;
      totalHours += 2; // Minimal hours for undated tasks
    }
  });

  // If no dated tasks but there are tasks in the array, assume some workload
  if (totalHours === 0 && tasks.length > 0) {
    totalHours = Math.min(20, tasks.length * 2); // 2 hours per task, max 20 hours
  }

  return Math.round(totalHours);
};

interface WorkloadChartProps {
  data: IWorkloadData | any; // Allow any to handle raw API responses
}

const WorkloadChart = ({ data }: WorkloadChartProps) => {
  const { t } = useTranslation('workload');
  const { alertThresholds, dateRange } = useAppSelector(state => state.projectWorkload);
  const { token } = theme.useToken();
  type ChartType = 'bar' | 'comparison';

  const [chartType, setChartType] = useState<ChartType>(() => {
    return (localStorage.getItem('workloadChartType') as ChartType) || 'bar';
  });

  useEffect(() => {
    localStorage.setItem('workloadChartType', chartType);
  }, [chartType]);
  const [sortBy, setSortBy] = useState<'name' | 'workload' | 'utilization'>('utilization');

  const sortedMembers = useMemo(() => {
    // Handle the case where data might have different structures
    let members = [];

    if (data?.members && Array.isArray(data.members)) {
      // If data is already transformed to IWorkloadData format
      members = [...data.members];
    } else if (data?.body && Array.isArray(data.body)) {
      // If data is raw API response format from /workload-members endpoint, transform it
      members = data.body.map((member: any) => {
        const dailyHours = Number(member.org_working_hours) || 8;
        const workingDaysPerWeek =
          calculateWorkingDaysFromOrgSettings(member.org_working_days) || 5;
        const weeklyCapacity = dailyHours * workingDaysPerWeek;

        // Calculate workload from tasks array for the selected date range
        const currentWorkload =
          calculateWorkloadFromTasks(member.tasks, dateRange.startDate, dateRange.endDate) || 0;

        // Calculate capacity for the same date range period based on actual working days
        const startDate = dateRange.startDate || new Date().toISOString().split('T')[0];
        const endDate = dateRange.endDate || new Date().toISOString().split('T')[0];
        const workingDaysInPeriod = calculateWorkingDaysInPeriod(
          startDate,
          endDate,
          member.org_working_days
        );
        let periodCapacity = workingDaysInPeriod * dailyHours;

        // Fallback: if periodCapacity is 0, use weekly capacity as fallback
        if (periodCapacity === 0) {
          periodCapacity = weeklyCapacity;
        }

        const utilizationPercentage =
          periodCapacity > 0 ? Math.round((currentWorkload / periodCapacity) * 100) : 0;

        return {
          id: member.project_member_id || member.team_member_id || member.user_id,
          name: member.name || t('table.unknown'),
          email: member.email || '',
          avatar: member.avatar_url,
          role: member.role,
          teamId: member.team_member_id,
          dailyCapacity: dailyHours,
          weeklyCapacity: weeklyCapacity,
          expectedCapacity: periodCapacity, // This is the correct capacity for the selected date range
          currentWorkload: currentWorkload,
          utilizationPercentage: utilizationPercentage,
          isOverallocated: utilizationPercentage > 100,
          isUnderutilized: utilizationPercentage < 50,
        };
      });
    } else if (Array.isArray(data)) {
      // If data is directly an array of members (direct API response)
      members = data.map((member: any) => {
        const dailyHours = Number(member.org_working_hours) || 8;
        const workingDaysPerWeek =
          calculateWorkingDaysFromOrgSettings(member.org_working_days) || 5;
        const weeklyCapacity = dailyHours * workingDaysPerWeek;

        // Calculate workload from tasks array for the selected date range
        const currentWorkload =
          calculateWorkloadFromTasks(member.tasks, dateRange.startDate, dateRange.endDate) || 0;

        // Calculate capacity for the same date range period based on actual working days
        const startDate = dateRange.startDate || new Date().toISOString().split('T')[0];
        const endDate = dateRange.endDate || new Date().toISOString().split('T')[0];
        const workingDaysInPeriod = calculateWorkingDaysInPeriod(
          startDate,
          endDate,
          member.org_working_days
        );
        let periodCapacity = workingDaysInPeriod * dailyHours;

        // Fallback: if periodCapacity is 0, use weekly capacity as fallback
        if (periodCapacity === 0) {
          periodCapacity = weeklyCapacity;
        }

        const utilizationPercentage =
          periodCapacity > 0 ? Math.round((currentWorkload / periodCapacity) * 100) : 0;

        return {
          id: member.project_member_id || member.team_member_id || member.user_id,
          name: member.name || t('table.unknown'),
          email: member.email || '',
          avatar: member.avatar_url,
          role: member.role,
          teamId: member.team_member_id,
          dailyCapacity: dailyHours,
          weeklyCapacity: weeklyCapacity,
          expectedCapacity: periodCapacity, // This is the correct capacity for the selected date range
          currentWorkload: currentWorkload,
          utilizationPercentage: utilizationPercentage,
          isOverallocated: utilizationPercentage > 100,
          isUnderutilized: utilizationPercentage < 50,
        };
      });
    } else {
      members = [];
    }

    switch (sortBy) {
      case 'name':
        return members.sort((a: any, b: any) => a.name.localeCompare(b.name));
      case 'workload':
        return members.sort((a: any, b: any) => b.currentWorkload - a.currentWorkload);
      case 'utilization':
        return members.sort((a: any, b: any) => b.utilizationPercentage - a.utilizationPercentage);
      default:
        return members;
    }
  }, [data, sortBy, dateRange.startDate, dateRange.endDate]);

  const chartData = useMemo(() => {
    const labels = sortedMembers.map((member: any) => member.name);

    if (chartType === 'comparison') {
      return {
        labels,
        datasets: [
          {
            label: t('chart.capacity'),
            data: sortedMembers.map((member: any) => member.expectedCapacity),
            backgroundColor: token.colorPrimary,
            borderColor: token.colorPrimary,
            borderWidth: 1,
          },
          {
            label: t('chart.allocated'),
            data: sortedMembers.map((member: any) => member.currentWorkload),
            backgroundColor: sortedMembers.map((member: any) =>
              member.isOverallocated ? token.colorError : token.colorSuccess
            ),
            borderColor: sortedMembers.map((member: any) =>
              member.isOverallocated ? token.colorError : token.colorSuccess
            ),
            borderWidth: 1,
          },
        ],
      };
    }

    return {
      labels,
      datasets: [
        {
          label: t('chart.utilization'),
          data: sortedMembers.map((member: any) => member.utilizationPercentage),
          backgroundColor: sortedMembers.map((member: any) => {
            if (member.utilizationPercentage > alertThresholds.overallocation)
              return token.colorError;
            if (member.utilizationPercentage < alertThresholds.underutilization)
              return token.colorWarning;
            return token.colorSuccess;
          }),
          borderColor: sortedMembers.map((member: any) => {
            if (member.utilizationPercentage > alertThresholds.overallocation)
              return token.colorError;
            if (member.utilizationPercentage < alertThresholds.underutilization)
              return token.colorWarning;
            return token.colorSuccess;
          }),
          borderWidth: 1,
        },
      ],
    };
  }, [sortedMembers, chartType, alertThresholds, t]);

  const chartOptions: ChartOptions<'bar'> = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index' as const,
        intersect: false,
      },
      plugins: {
        legend: {
          display: chartType === 'comparison',
          position: 'top' as const,
        },
        title: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: context => {
              if (chartType === 'comparison') {
                const value = context.parsed.y;
                return `${context.dataset.label}: ${formatTime(Number(value || 0))}`;
              } else {
                const member = sortedMembers[context.dataIndex];
                return [
                  `${t('chart.utilization')}: ${context.parsed.y}%`,
                  `${t('chart.allocated')}: ${formatTime(member.currentWorkload)}`,
                  `${t('chart.capacity')}: ${formatTime(member.expectedCapacity)}`,
                ];
              }
            },
            afterBody: tooltipItems => {
              const member = sortedMembers[tooltipItems[0]?.dataIndex];
              if (!member) return [];

              const statusText = member.isOverallocated
                ? t('status.overallocated')
                : member.isUnderutilized
                  ? t('status.underutilized')
                  : t('status.optimal');
              const lines = [`${t('table.status')}: ${statusText}`];

              if (chartType === 'comparison') {
                lines.push(`${t('chart.utilization')}: ${member.utilizationPercentage}%`);
              }
              return lines;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            maxRotation: 45, // Rotate labels if needed
            minRotation: 0,
            autoSkip: false, // Show all labels
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              if (chartType === 'comparison') {
                return formatTime(Number(value || 0));
              }
              return `${value}%`;
            },
          },
          max: chartType === 'comparison' ? undefined : 120,
        },
      },
      elements: {
        bar: {
          borderRadius: 4, // Rounded corners for better appearance
          borderSkipped: false, // Apply border radius to all corners
        },
      },
      layout: {
        padding: {
          left: 20,
          right: 20,
          top: 10,
          bottom: 10,
        },
      },
    };
  }, [chartType, t, sortedMembers]);

  // Check if we have any members to display
  const hasMembers = sortedMembers && sortedMembers.length > 0;

  if (!hasMembers) {
    return <Empty description={t('noMembersFound')} />;
  }

  return (
    <Flex vertical gap={16} style={{ padding: 6, flex: 1, minHeight: 0 }}>
      <style>
        {`
          .workload-chart-container::-webkit-scrollbar {
            height: 8px;
          }
          .workload-chart-container::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 4px;
          }
          .workload-chart-container::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 4px;
          }
          .workload-chart-container::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
          }
        `}
      </style>
      <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
        <PillToggleGroup<ChartType>
          value={chartType}
          onChange={setChartType}
          options={[
            { label: t('chart.barChart'), value: 'bar' },
            { label: t('chart.comparison'), value: 'comparison' },
          ]}
        />

        <Select
          size="small"
          value={sortBy}
          onChange={setSortBy}
          style={{ width: 190 }}
          options={[
            { label: t('chart.sortByName'), value: 'name' },
            { label: t('chart.sortByWorkload'), value: 'workload' },
            { label: t('chart.sortByUtilization'), value: 'utilization' },
          ]}
        />
      </Flex>

      <div
        className="workload-chart-container"
        style={{
          flex: 1,
          minHeight: 200,
          width: '100%',
          position: 'relative',
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        <div
          style={{
            minWidth: Math.max(600, sortedMembers.length * 50), // Smaller fixed width per column (50px instead of 80px)
            height: '100%',
          }}
        >
          <Bar
            data={chartData}
            options={{
              ...chartOptions,
              plugins: {
                ...chartOptions.plugins,
              },
              scales: {
                ...chartOptions.scales,
              },
              elements: {
                bar: {
                  ...chartOptions.elements?.bar,
                },
              },
            }}
          />
        </div>
      </div>
    </Flex>
  );
};

export default WorkloadChart;
