import { useState, useMemo } from 'react';
import {
  Calendar,
  Badge,
  Flex,
  Avatar,
  Tooltip,
  Typography,
  Card,
  Empty,
  Progress,
  theme,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import {
  IWorkloadData,
  ITaskAllocation,
  IMemberAvailability,
} from '@/types/workload/workload.types';
import dayjs, { Dayjs } from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import { useAppSelector } from '@/hooks/useAppSelector';

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

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

// Helper function to transform raw API response to IWorkloadData format
const transformToWorkloadData = (rawData: any, workingHoursPerDay: number = 8, t: any) => {
  const members = rawData?.body || rawData?.members || [];

  if (!Array.isArray(members)) {
    return {
      members: [],
      allocations: [],
      availability: [],
    };
  }

  const transformedMembers = members.map((member: any) => {
    const dailyHours = workingHoursPerDay; // Use the filter setting instead of org settings
    const workingDaysPerWeek = calculateWorkingDaysFromOrgSettings(member.org_working_days) || 5;
    const weeklyCapacity = dailyHours * workingDaysPerWeek;

    return {
      id: member.project_member_id || member.team_member_id || member.user_id,
      name: member.name || t('calendar.unknownMember'),
      email: member.email || '',
      avatar: member.avatar_url,
      role: member.role,
      teamId: member.team_member_id,
      dailyCapacity: dailyHours,
      weeklyCapacity: weeklyCapacity,
      expectedCapacity: weeklyCapacity, // Alias for compatibility with components
      currentWorkload: 0,
      utilizationPercentage: 0,
      isOverallocated: false,
      isUnderutilized: false,
    };
  });

  // Generate allocations from member tasks
  const allocations: ITaskAllocation[] = [];
  members.forEach((member: any) => {
    if (Array.isArray(member.tasks)) {
      member.tasks.forEach((task: any, index: number) => {
        // Calculate hours based on entry type
        let hours = 4; // Default estimation
        if (task.entry_type === 'time_log' && task.logged_hours) {
          hours = parseFloat(task.logged_hours);
        }

        const taskName =
          task.entry_type === 'time_log'
            ? `${task.task_name || t('calendar.task')} (${hours.toFixed(1)}h ${t('calendar.logged')})`
            : task.task_name || `${t('calendar.task')} ${index + 1}`;

        // Handle different date scenarios
        let startDateStr: string;
        let endDateStr: string;

        if (task.start_date && task.end_date) {
          // Both dates available
          startDateStr =
            typeof task.start_date === 'string'
              ? task.start_date.split('T')[0]
              : dayjs(task.start_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
          endDateStr =
            typeof task.end_date === 'string'
              ? task.end_date.split('T')[0]
              : dayjs(task.end_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
        } else if (task.start_date && !task.end_date) {
          // Only start date - assume single day task
          startDateStr =
            typeof task.start_date === 'string'
              ? task.start_date.split('T')[0]
              : dayjs(task.start_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
          endDateStr = startDateStr;
        } else if (!task.start_date && task.end_date) {
          // Only end date - assume single day task
          endDateStr =
            typeof task.end_date === 'string'
              ? task.end_date.split('T')[0]
              : dayjs(task.end_date, 'YYYY-MM-DD').format('YYYY-MM-DD');
          startDateStr = endDateStr;
        } else {
          // No dates - place on current date as unscheduled
          const currentDate = dayjs().format('YYYY-MM-DD');
          startDateStr = currentDate;
          endDateStr = currentDate;
        }

        allocations.push({
          id: `${member.project_member_id || member.team_member_id}-task-${task.task_id || index}-${startDateStr}`,
          taskId: task.task_id || `task-${index}`,
          taskName:
            !task.start_date && !task.end_date
              ? `${taskName} (${t('calendar.unscheduled')})`
              : taskName,
          projectId: 'current-project',
          projectName: t('calendar.currentProject'),
          memberId: member.project_member_id || member.team_member_id || member.user_id,
          memberName: member.name || t('calendar.unknownMember'),
          estimatedHours: hours,
          actualHours: task.entry_type === 'time_log' ? hours : 0,
          startDate: startDateStr,
          endDate: endDateStr,
          priority: task.priority_name || t('calendar.defaultPriority'),
          priorityColor: task.priority_color || '#1890ff',
          status: task.status_name || t('calendar.defaultStatus'),
          statusColor: task.status_color || '#52c41a',
          completionPercentage: 0,
        });
      });
    }
  });

  // Generate availability data
  const availability: IMemberAvailability[] = [];
  transformedMembers.forEach(member => {
    // Generate availability for next 60 days
    for (let i = 0; i < 60; i++) {
      const date = dayjs().add(i, 'day');
      const dayOfWeek = date.day(); // 0 = Sunday, 1 = Monday, etc.

      // Find the original member data to get working days
      const originalMember = members.find(
        m => (m.project_member_id || m.team_member_id || m.user_id) === member.id
      );
      const workingDays = originalMember?.org_working_days || {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false,
      };

      // Map day of week to working days object
      const dayNames = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ];
      const isWorkingDay = workingDays[dayNames[dayOfWeek]] || false;

      availability.push({
        memberId: member.id,
        date: date.format('YYYY-MM-DD'),
        availableHours: isWorkingDay ? workingHoursPerDay : 0,
        plannedHours: isWorkingDay ? Math.min(workingHoursPerDay, 4) : 0, // Assume 4 hours planned
        actualHours: 0,
        isWorkingDay: isWorkingDay,
        isHoliday: false,
        isLeave: false,
      });
    }
  });

  return {
    members: transformedMembers,
    allocations,
    availability,
  };
};

interface WorkloadCalendarProps {
  data: IWorkloadData | any; // Allow raw API responses
}

const WorkloadCalendar = ({ data }: WorkloadCalendarProps) => {
  const { t } = useTranslation('workload');
  const { showWeekends, alertThresholds, dateRange, workingHoursPerDay } = useAppSelector(
    state => state.projectWorkload
  );
  const { token } = theme.useToken();
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  // Transform raw API response to expected format
  const workloadData = useMemo(() => {
    if (data?.members && data?.allocations && data?.availability) {
      // Data is already in the expected format
      return data;
    }
    // Transform raw API response
    return transformToWorkloadData(data, workingHoursPerDay, t);
  }, [data, workingHoursPerDay, t]);

  const dateWorkloadMap = useMemo(() => {
    const map = new Map<
      string,
      {
        allocations: ITaskAllocation[];
        availability: IMemberAvailability[];
        totalHours: number;
        totalCapacity: number;
      }
    >();

    // Filter allocations to only process those within or overlapping the date range
    const filterStartDate = dayjs(dateRange.startDate);
    const filterEndDate = dayjs(dateRange.endDate);

    workloadData.allocations.forEach(allocation => {
      const start = dayjs(allocation.startDate);
      const end = dayjs(allocation.endDate);

      // Check if allocation overlaps with the selected date range
      const overlapsDateRange =
        start.isSameOrBefore(filterEndDate, 'day') && end.isSameOrAfter(filterStartDate, 'day');

      if (!overlapsDateRange) {
        return; // Skip allocations outside the date range
      }

      let current = start;

      while (current.isSameOrBefore(end, 'day')) {
        const dateKey = current.format('YYYY-MM-DD');

        // Only add to map if the current date is within the filter range
        if (
          current.isSameOrAfter(filterStartDate, 'day') &&
          current.isSameOrBefore(filterEndDate, 'day')
        ) {
          const existing = map.get(dateKey) || {
            allocations: [],
            availability: [],
            totalHours: 0,
            totalCapacity: 0,
          };

          existing.allocations.push(allocation);
          existing.totalHours += allocation.estimatedHours / Math.ceil(end.diff(start, 'day') + 1);
          map.set(dateKey, existing);
        }

        current = current.add(1, 'day');
      }
    });

    workloadData.availability.forEach(avail => {
      const dateKey = avail.date;
      const availDate = dayjs(avail.date);

      // Only add availability data if it's within the selected date range
      if (
        availDate.isSameOrAfter(filterStartDate, 'day') &&
        availDate.isSameOrBefore(filterEndDate, 'day')
      ) {
        const existing = map.get(dateKey) || {
          allocations: [],
          availability: [],
          totalHours: 0,
          totalCapacity: 0,
        };

        existing.availability.push(avail);
        existing.totalCapacity += avail.availableHours;
        map.set(dateKey, existing);
      }
    });

    return map;
  }, [workloadData, dateRange.startDate, dateRange.endDate]);

  const dateCellRender = (date: Dayjs) => {
    const dateKey = date.format('YYYY-MM-DD');
    const workload = dateWorkloadMap.get(dateKey);

    if (!workload || workload.allocations.length === 0) {
      return null;
    }

    const utilization =
      workload.totalCapacity > 0 ? (workload.totalHours / workload.totalCapacity) * 100 : 0;

    const status =
      utilization > alertThresholds.overallocation
        ? 'error'
        : utilization > 80
          ? 'warning'
          : 'success';

    const tasksByMember = workload.allocations.reduce(
      (acc, task) => {
        if (!acc[task.memberId]) {
          acc[task.memberId] = [];
        }
        acc[task.memberId].push(task);
        return acc;
      },
      {} as Record<string, ITaskAllocation[]>
    );

    const totalTaskCount = workload.allocations.length;

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '20px',
          padding: '4px 6px',
          borderRadius: '6px',
          backgroundColor:
            status === 'error'
              ? token.colorErrorBg
              : status === 'warning'
                ? token.colorWarningBg
                : token.colorSuccessBg,
          border: `1px solid ${
            status === 'error'
              ? token.colorErrorBorder
              : status === 'warning'
                ? token.colorWarningBorder
                : token.colorSuccessBorder
          }`,
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'scale(1.05)',
            boxShadow: token.boxShadow,
          },
        }}
        onClick={() => setSelectedDate(date)}
      >
        <Typography.Text
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color:
              status === 'error'
                ? token.colorError
                : status === 'warning'
                  ? token.colorWarning
                  : token.colorSuccess,
            margin: 0,
          }}
        >
          {totalTaskCount}
        </Typography.Text>
      </div>
    );
  };

  const monthCellRender = (date: Dayjs) => {
    const monthStart = date.startOf('month');
    const monthEnd = date.endOf('month');
    let totalTasks = 0;
    let totalHours = 0;

    dateWorkloadMap.forEach((workload, dateKey) => {
      const workloadDate = dayjs(dateKey);
      // Since dateWorkloadMap is already filtered by date range, just check if it's within the month
      const isWithinMonth =
        workloadDate.isSameOrAfter(monthStart) && workloadDate.isSameOrBefore(monthEnd);

      if (isWithinMonth) {
        totalTasks += workload.allocations.length;
        totalHours += workload.totalHours;
      }
    });

    if (totalTasks === 0) return null;

    return (
      <Flex vertical gap={4}>
        <Typography.Text style={{ fontSize: 11, color: token.colorText }}>
          {t('calendar.totalTasks', { count: totalTasks })}
        </Typography.Text>
        <Typography.Text style={{ fontSize: 11, color: token.colorText }}>
          {t('calendar.totalHours', { hours: Math.round(totalHours) })}
        </Typography.Text>
      </Flex>
    );
  };

  const selectedDateWorkload = dateWorkloadMap.get(selectedDate.format('YYYY-MM-DD'));

  if (workloadData.members.length === 0) {
    return <Empty description={t('noWorkloadData')} />;
  }

  return (
    <Flex gap={16}>
      <div style={{ flex: 1 }}>
        <Calendar
          value={selectedDate}
          onSelect={setSelectedDate}
          mode={viewMode}
          onPanelChange={(date, mode) => {
            setSelectedDate(date);
            setViewMode(mode as 'month' | 'week');
          }}
          dateCellRender={dateCellRender}
          monthCellRender={monthCellRender}
        />
      </div>

      <Card
        title={
          <Flex align="center" justify="space-between">
            <Typography.Text style={{ fontSize: 16, fontWeight: 600 }}>
              {selectedDate.format('MMM DD, YYYY')}
            </Typography.Text>
            <Typography.Text style={{ fontSize: 12, color: token.colorTextSecondary }}>
              {selectedDate.format('dddd')}
            </Typography.Text>
          </Flex>
        }
        style={{
          width: 380,
          boxShadow: token.boxShadow,
          borderRadius: '8px',
        }}
        styles={{ body: { padding: '16px' } }}
      >
        {selectedDateWorkload && selectedDateWorkload.allocations.length > 0 ? (
          <Flex vertical gap={20}>
            {/* Utilization Overview with Progress Bar */}
            <div
              style={{
                padding: '12px',
                background: token.colorFillQuaternary,
                borderRadius: '6px',
              }}
            >
              <Flex align="center" justify="space-between" style={{ marginBottom: 8 }}>
                <Typography.Text
                  style={{ fontSize: 12, fontWeight: 500, color: token.colorTextSecondary }}
                >
                  {t('calendar.utilization')}
                </Typography.Text>
                <Typography.Text
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color:
                      selectedDateWorkload.totalCapacity > 0 &&
                      selectedDateWorkload.totalHours / selectedDateWorkload.totalCapacity > 1
                        ? token.colorError
                        : selectedDateWorkload.totalCapacity > 0 &&
                            selectedDateWorkload.totalHours / selectedDateWorkload.totalCapacity >
                              0.8
                          ? token.colorWarning
                          : token.colorSuccess,
                  }}
                >
                  {selectedDateWorkload.totalCapacity > 0
                    ? Math.round(
                        (selectedDateWorkload.totalHours / selectedDateWorkload.totalCapacity) * 100
                      )
                    : 0}
                  %
                </Typography.Text>
              </Flex>
              <Progress
                percent={
                  selectedDateWorkload.totalCapacity > 0
                    ? Math.min(
                        100,
                        Math.round(
                          (selectedDateWorkload.totalHours / selectedDateWorkload.totalCapacity) *
                            100
                        )
                      )
                    : 0
                }
                strokeColor={{
                  '0%':
                    selectedDateWorkload.totalCapacity > 0 &&
                    selectedDateWorkload.totalHours / selectedDateWorkload.totalCapacity > 1
                      ? token.colorError
                      : selectedDateWorkload.totalCapacity > 0 &&
                          selectedDateWorkload.totalHours / selectedDateWorkload.totalCapacity > 0.8
                        ? token.colorWarning
                        : token.colorSuccess,
                  '100%':
                    selectedDateWorkload.totalCapacity > 0 &&
                    selectedDateWorkload.totalHours / selectedDateWorkload.totalCapacity > 1
                      ? token.colorError
                      : selectedDateWorkload.totalCapacity > 0 &&
                          selectedDateWorkload.totalHours / selectedDateWorkload.totalCapacity > 0.8
                        ? token.colorWarning
                        : token.colorSuccess,
                }}
                size="small"
                showInfo={false}
                style={{ marginBottom: 4 }}
              />
              <Flex justify="space-between">
                <Typography.Text style={{ fontSize: 11, color: token.colorTextTertiary }}>
                  {t('calendar.hoursAssigned', {
                    hours: selectedDateWorkload.totalHours.toFixed(1),
                  })}
                </Typography.Text>
                <Typography.Text style={{ fontSize: 11, color: token.colorTextTertiary }}>
                  {t('calendar.capacityHours', { hours: selectedDateWorkload.totalCapacity })}
                </Typography.Text>
              </Flex>
            </div>

            {/* Task Count Summary Cards */}
            <Flex gap={12}>
              <div
                style={{
                  flex: 1,
                  padding: '12px',
                  background: token.colorPrimaryBg,
                  borderRadius: '6px',
                  border: `1px solid ${token.colorPrimaryBorder}`,
                  textAlign: 'center',
                }}
              >
                <Typography.Text
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: token.colorPrimary,
                    display: 'block',
                  }}
                >
                  {selectedDateWorkload.allocations.length}
                </Typography.Text>
                <Typography.Text style={{ fontSize: 11, color: token.colorTextSecondary }}>
                  {selectedDateWorkload.allocations.length === 1
                    ? t('calendar.task')
                    : t('calendar.tasks_plural')}
                </Typography.Text>
              </div>
              <div
                style={{
                  flex: 1,
                  padding: '12px',
                  background: token.colorInfoBg,
                  borderRadius: '6px',
                  border: `1px solid ${token.colorInfoBorder}`,
                  textAlign: 'center',
                }}
              >
                <Typography.Text
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: token.colorInfo,
                    display: 'block',
                  }}
                >
                  {new Set(selectedDateWorkload.allocations.map(t => t.memberId)).size}
                </Typography.Text>
                <Typography.Text style={{ fontSize: 11, color: token.colorTextSecondary }}>
                  {new Set(selectedDateWorkload.allocations.map(t => t.memberId)).size === 1
                    ? t('calendar.member')
                    : t('calendar.members_plural')}
                </Typography.Text>
              </div>
            </Flex>

            {/* Task Details with Better Layout */}
            <div>
              <Typography.Text
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: token.colorTextSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {t('calendar.assignedTasks')}
              </Typography.Text>
              <div
                style={{
                  marginTop: 12,
                  maxHeight: '300px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                }}
              >
                <Flex vertical gap={10}>
                  {selectedDateWorkload.allocations.map(task => {
                    const member = workloadData.members.find(m => m.id === task.memberId);
                    const isTimeLog = task.actualHours > 0;
                    return (
                      <div
                        key={task.id}
                        style={{
                          padding: '10px',
                          background: token.colorBgContainer,
                          borderRadius: '6px',
                          border: `1px solid ${token.colorBorderSecondary}`,
                          transition: 'all 0.2s ease',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = token.colorFillTertiary;
                          e.currentTarget.style.borderColor = token.colorPrimaryBorder;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = token.colorBgContainer;
                          e.currentTarget.style.borderColor = token.colorBorderSecondary;
                        }}
                      >
                        <Flex align="flex-start" gap={10}>
                          <Tooltip title={member?.name}>
                            <Avatar
                              size={32}
                              style={{
                                backgroundColor: token.colorPrimary,
                                flexShrink: 0,
                              }}
                            >
                              {member?.name.charAt(0) || t('calendar.unknownInitial')}
                            </Avatar>
                          </Tooltip>
                          <Flex vertical style={{ flex: 1, minWidth: 0 }}>
                            <Typography.Text
                              ellipsis
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: token.colorText,
                                marginBottom: 2,
                              }}
                            >
                              {task.taskName}
                            </Typography.Text>
                            <Flex align="center" gap={8}>
                              <Typography.Text
                                style={{
                                  fontSize: 11,
                                  color: token.colorTextSecondary,
                                }}
                              >
                                {member?.name}
                              </Typography.Text>
                              <Typography.Text style={{ color: token.colorTextQuaternary }}>
                                •
                              </Typography.Text>
                              <Typography.Text
                                style={{
                                  fontSize: 11,
                                  color: isTimeLog ? token.colorSuccess : token.colorInfo,
                                  fontWeight: 500,
                                }}
                              >
                                {isTimeLog
                                  ? `${task.actualHours.toFixed(1)}h ${t('calendar.logged')}`
                                  : `${task.estimatedHours.toFixed(1)}h ${t('calendar.planned')}`}
                              </Typography.Text>
                            </Flex>
                            <Flex align="center" gap={6} style={{ marginTop: 4 }}>
                              <Badge
                                color={task.statusColor || 'blue'}
                                text={task.status}
                                style={{ fontSize: 10 }}
                              />
                              {task.priority && (
                                <Badge
                                  color={task.priorityColor || 'default'}
                                  text={task.priority}
                                  style={{ fontSize: 10 }}
                                />
                              )}
                            </Flex>
                          </Flex>
                        </Flex>
                      </div>
                    );
                  })}
                </Flex>
              </div>
            </div>

            {/* Team Availability Section */}
            {selectedDateWorkload.availability.length > 0 && (
              <div>
                <Typography.Text
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: token.colorTextSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  {t('calendar.teamAvailability')}
                </Typography.Text>
                <div
                  style={{
                    marginTop: 12,
                    padding: '10px',
                    background: token.colorFillQuaternary,
                    borderRadius: '6px',
                  }}
                >
                  <Flex vertical gap={8}>
                    {selectedDateWorkload.availability
                      .filter(avail => avail.availableHours > 0)
                      .slice(0, 5)
                      .map(avail => {
                        const member = workloadData.members.find(m => m.id === avail.memberId);
                        const utilizationPercent =
                          avail.availableHours > 0
                            ? (avail.plannedHours / avail.availableHours) * 100
                            : 0;
                        return (
                          <Flex key={avail.memberId} align="center" justify="space-between">
                            <Flex align="center" gap={8}>
                              <Avatar
                                size={20}
                                style={{ backgroundColor: token.colorTextQuaternary }}
                              >
                                {member?.name.charAt(0) || t('calendar.unknownInitial')}
                              </Avatar>
                              <Typography.Text style={{ fontSize: 12, color: token.colorText }}>
                                {member?.name}
                              </Typography.Text>
                            </Flex>
                            <Flex align="center" gap={8}>
                              <Progress
                                percent={Math.round(utilizationPercent)}
                                size="small"
                                style={{ width: 60 }}
                                showInfo={false}
                                strokeColor={
                                  utilizationPercent > 100 ? token.colorError : token.colorSuccess
                                }
                              />
                              <Typography.Text
                                style={{
                                  fontSize: 11,
                                  color: token.colorTextSecondary,
                                  minWidth: '45px',
                                  textAlign: 'right',
                                }}
                              >
                                {avail.plannedHours}/{avail.availableHours}h
                              </Typography.Text>
                            </Flex>
                          </Flex>
                        );
                      })}
                  </Flex>
                </div>
              </div>
            )}
          </Flex>
        ) : (
          <Empty
            description={t('calendar.noTasksScheduled')}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </Card>
    </Flex>
  );
};

export default WorkloadCalendar;
