import {
  Row,
  Col,
  Card,
  Statistic,
  Progress,
  Flex,
  Skeleton,
  Typography,
  theme,
  Tooltip,
} from '@/shared/antd-imports';
import {
  TeamOutlined,
  ClockCircleOutlined,
  AlertOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { IWorkloadData } from '@/types/workload/workload.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import { formatTime } from '@/api/project-workload/project-workload.api.service';

// Helper function to calculate working days per week from organization settings
const calculateWorkingDaysFromOrgSettings = (workingDays: any): number => {
  if (!workingDays) return 5;
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

  tasks.forEach(task => {
    if (task?.start_date && task?.end_date) {
      const startDate = new Date(task.start_date);
      const endDate = new Date(task.end_date);

      if (startDate <= endOfPeriod && endDate >= startOfPeriod) {
        const overlapStart = new Date(Math.max(startDate.getTime(), startOfPeriod.getTime()));
        const overlapEnd = new Date(Math.min(endDate.getTime(), endOfPeriod.getTime()));
        const overlapDays = Math.max(
          1,
          Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24))
        );

        const baseHours = Math.min(6, Math.max(3, overlapDays * 0.5));
        totalHours += baseHours;
      }
    } else if (task?.end_date) {
      const endDate = new Date(task.end_date);
      if (endDate >= startOfPeriod && endDate <= endOfPeriod) {
        totalHours += 4;
      }
    } else if (!task?.start_date && !task?.end_date) {
      totalHours += 2;
    }
  });

  if (totalHours === 0 && tasks.length > 0) {
    totalHours = Math.min(20, tasks.length * 2);
  }

  return Math.round(totalHours);
};

// Helper function to calculate summary from raw API response
const calculateSummaryFromRawData = (data: any, startDate?: string, endDate?: string) => {
  const members = data?.body || data?.members || [];

  if (!Array.isArray(members) || members.length === 0) {
    return {
      totalMembers: 0,
      totalTasks: 0,
      totalEstimatedHours: 0,
      totalActualHours: 0,
      averageUtilization: 0,
      overallocatedMembers: 0,
      underutilizedMembers: 0,
      criticalTasks: 0,
    };
  }

  let totalEstimatedHours = 0;
  let totalActualHours = 0;
  let totalCapacity = 0;
  let overallocatedCount = 0;
  let underutilizedCount = 0;
  let totalTasksCount = 0;

  members.forEach((member: any) => {
    const dailyHours = Number(member.org_working_hours) || 8;

    // Calculate actual logged hours from logs_date_union (total time spent)
    let memberActualHours = 0;
    if (member.logs_date_union && member.logs_date_union.total_time_spent_seconds) {
      memberActualHours = Number(member.logs_date_union.total_time_spent_seconds) / 3600; // Convert seconds to hours
    }

    // Calculate estimated hours from planned tasks with date ranges
    let memberEstimatedHours = 0;
    let plannedTasksCount = 0;

    if (Array.isArray(member.tasks)) {
      member.tasks.forEach((task: any) => {
        if (task.entry_type === 'task' && task.start_date && task.end_date) {
          // For planned tasks, estimate based on duration
          const start = new Date(task.start_date);
          const end = new Date(task.end_date);
          const durationDays = Math.max(
            1,
            Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
          );
          memberEstimatedHours += Math.min(8, Math.max(2, durationDays * 2)); // 2-8 hours based on duration
          plannedTasksCount++;
        }
      });
    }

    // If no planned tasks but we have logged time, estimate based on logged time * 1.2 (20% buffer)
    if (memberEstimatedHours === 0 && memberActualHours > 0) {
      memberEstimatedHours = memberActualHours * 1.2; // Estimate 20% more than actual logged time
    }

    // Final fallback: use a minimal default based on planned task count only
    if (memberEstimatedHours === 0 && plannedTasksCount > 0) {
      memberEstimatedHours = plannedTasksCount * 4; // 4 hours per planned task default
    }

    // Calculate capacity for the date range period
    const workingDaysInPeriod = calculateWorkingDaysInPeriod(
      startDate || new Date().toISOString().split('T')[0],
      endDate || new Date().toISOString().split('T')[0],
      member.org_working_days
    );
    const periodCapacity = workingDaysInPeriod * dailyHours;

    // Calculate utilization based on actual logged hours vs capacity
    const utilizationPercentage =
      periodCapacity > 0 ? Math.round((memberActualHours / periodCapacity) * 100) : 0;

    totalEstimatedHours += memberEstimatedHours;
    totalActualHours += memberActualHours;
    totalCapacity += periodCapacity;
    totalTasksCount += member.tasks?.length || 0;

    if (utilizationPercentage > 100) {
      overallocatedCount++;
    } else if (utilizationPercentage < 50) {
      underutilizedCount++;
    }
  });

  const averageUtilization =
    totalCapacity > 0 ? Math.round((totalActualHours / totalCapacity) * 100) : 0;

  return {
    totalMembers: members.length,
    totalTasks: totalTasksCount,
    totalEstimatedHours: Math.round(totalEstimatedHours * 10) / 10, // Round to 1 decimal place
    totalActualHours: Math.round(totalActualHours * 10) / 10, // Round to 1 decimal place
    averageUtilization: averageUtilization,
    overallocatedMembers: overallocatedCount,
    underutilizedMembers: underutilizedCount,
    criticalTasks: Math.round(totalTasksCount * 0.1), // Estimate 10% of tasks as critical
  };
};

interface WorkloadOverviewProps {
  data?: IWorkloadData | any; // Allow raw API responses
  isLoading: boolean;
}

const WorkloadOverview = ({ data, isLoading }: WorkloadOverviewProps) => {
  const { t } = useTranslation('workload');
  const { token } = theme.useToken();
  const { alertThresholds, dateRange } = useAppSelector(state => state.projectWorkload);

  if (isLoading) {
    return (
      <Row gutter={[16, 16]}>
        {[1, 2, 3, 4].map(key => (
          <Col xs={24} sm={12} lg={6} key={key}>
            <Card style={{ height: '100%' }}>
              <Skeleton active paragraph={{ rows: 2 }} />
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  if (!data) {
    return (
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card style={{ height: '100%' }}>
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Typography.Text type="secondary">{t('noWorkloadData')}</Typography.Text>
            </div>
          </Card>
        </Col>
      </Row>
    );
  }

  // Handle both transformed IWorkloadData and raw API response
  const summary =
    data?.summary || calculateSummaryFromRawData(data, dateRange.startDate, dateRange.endDate);

  const utilizationColor =
    summary.averageUtilization > 100
      ? token.colorError
      : summary.averageUtilization > 80
        ? token.colorWarning
        : token.colorSuccess;

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} md={6}>
        <Card style={{ height: '100%' }}>
          <Tooltip
            title={`Team composition and allocation status.

Member Status:
• Total Members: ${summary.totalMembers}
• Overallocated: ${summary.overallocatedMembers} (>100% utilization)
• Underutilized: ${summary.underutilizedMembers} (<${alertThresholds.underutilization}% utilization)
• Optimal: ${summary.totalMembers - summary.overallocatedMembers - summary.underutilizedMembers}`}
            placement="top"
          >
            <Statistic
              title={
                <Flex align="center" gap={4}>
                  {t('overview.teamMembers')}
                  <InfoCircleOutlined style={{ fontSize: 12, opacity: 0.5 }} />
                </Flex>
              }
              value={summary.totalMembers}
              prefix={<TeamOutlined />}
            />
          </Tooltip>
        </Card>
      </Col>

      <Col xs={24} sm={12} md={6}>
        <Card style={{ height: '100%' }}>
          <Tooltip
            title={`Total estimated workload across all team members.

Includes:
• Estimated Hours: ${summary.totalEstimatedHours}h
• Actual Hours Logged: ${summary.totalActualHours}h
• Progress: ${summary.totalEstimatedHours > 0 ? Math.round((summary.totalActualHours / summary.totalEstimatedHours) * 100) : summary.totalActualHours > 0 ? 100 : 0}%`}
            placement="top"
          >
            <Statistic
              title={
                <Flex align="center" gap={4}>
                  {t('overview.totalWorkload')}
                  <InfoCircleOutlined style={{ fontSize: 12, opacity: 0.5 }} />
                </Flex>
              }
              value={formatTime(summary.totalEstimatedHours)}
              prefix={<ClockCircleOutlined />}
            />
          </Tooltip>
          <Progress
            percent={
              summary.totalEstimatedHours > 0
                ? Math.round((summary.totalActualHours / summary.totalEstimatedHours) * 100)
                : summary.totalActualHours > 0
                  ? 100
                  : 0
            }
            size="small"
            status={summary.totalActualHours > summary.totalEstimatedHours ? 'exception' : 'active'}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={6}>
        <Card style={{ height: '100%' }}>
          <Tooltip
            title={t('calculations.averageUtilizationTooltip', {
              average: summary.averageUtilization.toFixed(1),
              memberCount: summary.totalMembers,
              totalAssigned: summary.totalEstimatedHours,
              totalCapacity:
                summary.totalMembers > 0
                  ? Math.round((summary.totalEstimatedHours * 100) / summary.averageUtilization)
                  : 0,
            })}
            placement="top"
          >
            <Statistic
              title={
                <Flex align="center" gap={4}>
                  {t('overview.averageUtilization')}
                  <InfoCircleOutlined style={{ fontSize: 12, opacity: 0.5 }} />
                </Flex>
              }
              value={summary.averageUtilization}
              precision={1}
              suffix="%"
              valueStyle={{ color: utilizationColor }}
              prefix={<CheckCircleOutlined />}
            />
          </Tooltip>
          <Progress
            percent={summary.averageUtilization}
            strokeColor={utilizationColor}
            size="small"
            showInfo={false}
          />
        </Card>
      </Col>

      <Col xs={24} sm={12} md={6}>
        <Card style={{ height: '100%' }}>
          <Tooltip
            title={t('overview.criticalTasksTooltip', {
              criticalTasks: summary.criticalTasks,
              totalTasks: summary.totalTasks,
              criticalPercentage: Math.round((summary.criticalTasks / summary.totalTasks) * 100),
            })}
            placement="top"
          >
            <Statistic
              title={
                <Flex align="center" gap={4}>
                  {t('overview.criticalTasks')}
                  <InfoCircleOutlined style={{ fontSize: 12, opacity: 0.5 }} />
                </Flex>
              }
              value={summary.criticalTasks}
              valueStyle={{
                color: summary.criticalTasks > 0 ? token.colorError : token.colorSuccess,
              }}
              prefix={<AlertOutlined />}
            />
          </Tooltip>
          <div style={{ fontSize: 12, color: token.colorTextSecondary, marginTop: 8 }}>
            {t('overview.totalTasks', { count: summary.totalTasks })}
          </div>
        </Card>
      </Col>
    </Row>
  );
};

export default WorkloadOverview;
