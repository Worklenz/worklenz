import { useState, useMemo } from 'react';
import {
  Flex,
  Select,
  Radio,
  Avatar,
  Progress,
  Typography,
  Badge,
  Empty,
  theme,
  Tooltip,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { IWorkloadData, IWorkloadMember } from '@/types/workload/workload.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import { Bar } from 'react-chartjs-2';
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

interface WorkloadChartProps {
  data: IWorkloadData;
}

const WorkloadChart = ({ data }: WorkloadChartProps) => {
  const { t } = useTranslation('workload');
  const { capacityUnit, alertThresholds } = useAppSelector(state => state.projectWorkload);
  const { token } = theme.useToken();
  const [chartType, setChartType] = useState<'bar' | 'stacked' | 'comparison'>('bar');
  const [sortBy, setSortBy] = useState<'name' | 'workload' | 'utilization'>('utilization');

  const sortedMembers = useMemo(() => {
    const members = [...data.members];
    switch (sortBy) {
      case 'name':
        return members.sort((a, b) => a.name.localeCompare(b.name));
      case 'workload':
        return members.sort((a, b) => b.currentWorkload - a.currentWorkload);
      case 'utilization':
        return members.sort((a, b) => b.utilizationPercentage - a.utilizationPercentage);
      default:
        return members;
    }
  }, [data.members, sortBy]);

  const chartData = useMemo(() => {
    const labels = sortedMembers.map(member => member.name);

    if (chartType === 'comparison') {
      return {
        labels,
        datasets: [
          {
            label: t('chart.capacity'),
            data: sortedMembers.map(member =>
              capacityUnit === 'hours' ? member.weeklyCapacity : member.weeklyCapacity / 8
            ),
            backgroundColor: token.colorPrimary,
            borderColor: token.colorPrimary,
            borderWidth: 1,
          },
          {
            label: t('chart.allocated'),
            data: sortedMembers.map(member =>
              capacityUnit === 'hours' ? member.currentWorkload : member.currentWorkload / 8
            ),
            backgroundColor: sortedMembers.map(member =>
              member.isOverallocated ? token.colorError : token.colorSuccess
            ),
            borderColor: sortedMembers.map(member =>
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
          data: sortedMembers.map(member => member.utilizationPercentage),
          backgroundColor: sortedMembers.map(member => {
            if (member.utilizationPercentage > alertThresholds.overallocation)
              return token.colorError;
            if (member.utilizationPercentage < alertThresholds.underutilization)
              return token.colorWarning;
            return token.colorSuccess;
          }),
          borderColor: sortedMembers.map(member => {
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
  }, [sortedMembers, chartType, capacityUnit, alertThresholds, t]);

  const chartOptions: ChartOptions<'bar'> = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
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
                const unit = capacityUnit === 'hours' ? 'h' : 'pts';
                return `${context.dataset.label}: ${value}${unit}`;
              } else {
                const member = sortedMembers[context.dataIndex];
                return [
                  `${t('chart.utilization')}: ${context.parsed.y}%`,
                  `${t('chart.allocated')}: ${member.currentWorkload}h`,
                  `${t('chart.capacity')}: ${member.weeklyCapacity}h`,
                ];
              }
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              if (chartType === 'comparison') {
                const unit = capacityUnit === 'hours' ? 'h' : 'pts';
                return `${value}${unit}`;
              }
              return `${value}%`;
            },
          },
          max: chartType === 'comparison' ? undefined : 120,
        },
      },
    };
  }, [chartType, capacityUnit, t, sortedMembers]);

  if (data.members.length === 0) {
    return <Empty description={t('noMembersFound')} />;
  }

  return (
    <Flex vertical gap={16}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
        <Radio.Group value={chartType} onChange={e => setChartType(e.target.value)}>
          <Radio.Button value="bar">{t('chart.barChart')}</Radio.Button>
          <Radio.Button value="comparison">{t('chart.comparison')}</Radio.Button>
        </Radio.Group>

        <Select
          value={sortBy}
          onChange={setSortBy}
          style={{ width: 150 }}
          options={[
            { label: t('chart.sortByName'), value: 'name' },
            { label: t('chart.sortByWorkload'), value: 'workload' },
            { label: t('chart.sortByUtilization'), value: 'utilization' },
          ]}
        />
      </Flex>

      <div style={{ height: 400 }}>
        <Bar data={chartData} options={chartOptions} />
      </div>

      <Flex vertical gap={12} style={{ marginTop: 16 }}>
        <Typography.Title level={5}>{t('chart.memberDetails')}</Typography.Title>
        {sortedMembers.map(member => (
          <MemberWorkloadCard key={member.id} member={member} capacityUnit={capacityUnit} />
        ))}
      </Flex>
    </Flex>
  );
};

const MemberWorkloadCard = ({
  member,
  capacityUnit,
}: {
  member: IWorkloadMember;
  capacityUnit: 'hours' | 'points';
}) => {
  const { t } = useTranslation('workload');
  const { alertThresholds } = useAppSelector(state => state.projectWorkload);
  const { token } = theme.useToken();

  // Calculate working days from weekly capacity and daily capacity
  const workingDays =
    member.dailyCapacity > 0 ? Math.round(member.weeklyCapacity / member.dailyCapacity) : 5;

  const getStatusTooltip = () => {
    if (member.isOverallocated) {
      return t('calculations.statusTooltip.overallocated');
    }
    if (member.isUnderutilized) {
      return t('calculations.statusTooltip.underutilized', {
        threshold: alertThresholds.underutilization,
      });
    }
    return t('calculations.statusTooltip.optimal', { threshold: alertThresholds.underutilization });
  };

  const status =
    member.utilizationPercentage > alertThresholds.overallocation
      ? 'exception'
      : member.utilizationPercentage < alertThresholds.underutilization
        ? 'normal'
        : 'success';

  const statusBadge = member.isOverallocated
    ? { text: t('status.overallocated'), color: 'red' }
    : member.isUnderutilized
      ? { text: t('status.underutilized'), color: 'orange' }
      : { text: t('status.optimal'), color: 'green' };

  return (
    <Flex
      align="center"
      gap={16}
      style={{
        padding: 12,
        borderRadius: 8,
        backgroundColor: token.colorFillAlter,
        border: `1px solid ${token.colorBorder}`,
      }}
    >
      <Avatar src={member.avatar} size={40}>
        {member.name.charAt(0).toUpperCase()}
      </Avatar>

      <Flex vertical style={{ flex: 1 }}>
        <Flex align="center" gap={8}>
          <Typography.Text strong>{member.name}</Typography.Text>
          <Tooltip title={getStatusTooltip()} placement="top">
            <Badge color={statusBadge.color} text={statusBadge.text} />
          </Tooltip>
        </Flex>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {member.role || member.email}
        </Typography.Text>
      </Flex>

      <Flex vertical align="end" style={{ minWidth: 200 }}>
        <Tooltip
          title={t('calculations.utilizationTooltip', {
            utilization: member.utilizationPercentage,
            assignedHours: member.currentWorkload,
            weeklyCapacity: member.weeklyCapacity,
            dailyHours: member.dailyCapacity,
            workingDays: workingDays,
          })}
          placement="left"
        >
          <Typography.Text>
            {member.currentWorkload} / {member.weeklyCapacity}{' '}
            {capacityUnit === 'hours' ? t('overview.hours') : t('overview.points')}
          </Typography.Text>
        </Tooltip>
        <Tooltip
          title={t('calculations.utilizationTooltip', {
            utilization: member.utilizationPercentage,
            assignedHours: member.currentWorkload,
            weeklyCapacity: member.weeklyCapacity,
            dailyHours: member.dailyCapacity,
            workingDays: workingDays,
          })}
          placement="left"
        >
          <Progress
            percent={member.utilizationPercentage}
            size="small"
            status={status}
            style={{ marginBottom: 0 }}
          />
        </Tooltip>
      </Flex>
    </Flex>
  );
};

export default WorkloadChart;
