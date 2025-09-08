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
const transformToWorkloadData = (rawData: any) => {
  const members = rawData?.body || rawData?.members || [];
  
  if (!Array.isArray(members)) {
    return {
      members: [],
      allocations: [],
      availability: [],
    };
  }
  
  const transformedMembers = members.map((member: any) => {
    const dailyHours = member.org_working_hours || 8;
    const workingDaysPerWeek = calculateWorkingDaysFromOrgSettings(member.org_working_days) || 5;
    const weeklyCapacity = dailyHours * workingDaysPerWeek;
    
    return {
      id: member.project_member_id || member.team_member_id || member.user_id,
      name: member.name || 'Unknown',
      email: member.email || '',
      avatar: member.avatar_url,
      role: member.role,
      teamId: member.team_member_id,
      dailyCapacity: dailyHours,
      weeklyCapacity: weeklyCapacity,
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
        if (task.start_date && task.end_date) {
          allocations.push({
            id: `${member.project_member_id || member.team_member_id}-task-${index}`,
            taskId: `task-${index}`,
            taskName: `Task ${index + 1}`,
            projectId: 'current-project',
            projectName: 'Current Project',
            memberId: member.project_member_id || member.team_member_id || member.user_id,
            memberName: member.name || 'Unknown',
            estimatedHours: 4, // Default estimation
            actualHours: 0,
            startDate: task.start_date.split('T')[0], // Extract date part
            endDate: task.end_date.split('T')[0], // Extract date part
            priority: 'Medium',
            priorityColor: '#1890ff',
            status: 'In Progress',
            statusColor: '#52c41a',
            completionPercentage: 0,
          });
        }
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
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const isWorkingDay = workingDays[dayNames[dayOfWeek]] || false;
      
      availability.push({
        memberId: member.id,
        date: date.format('YYYY-MM-DD'),
        availableHours: isWorkingDay ? member.dailyCapacity : 0,
        plannedHours: isWorkingDay ? Math.min(member.dailyCapacity, 4) : 0, // Assume 4 hours planned
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
  const { showWeekends, alertThresholds, dateRange } = useAppSelector(state => state.projectWorkload);
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
    return transformToWorkloadData(data);
  }, [data]);

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

    workloadData.allocations.forEach(allocation => {
      const start = dayjs(allocation.startDate);
      const end = dayjs(allocation.endDate);
      let current = start;

      while (current.isSameOrBefore(end, 'day')) {
        const dateKey = current.format('YYYY-MM-DD');
        const existing = map.get(dateKey) || {
          allocations: [],
          availability: [],
          totalHours: 0,
          totalCapacity: 0,
        };

        existing.allocations.push(allocation);
        existing.totalHours += allocation.estimatedHours / Math.ceil(end.diff(start, 'day') + 1);
        map.set(dateKey, existing);

        current = current.add(1, 'day');
      }
    });

    workloadData.availability.forEach(avail => {
      const dateKey = avail.date;
      const existing = map.get(dateKey) || {
        allocations: [],
        availability: [],
        totalHours: 0,
        totalCapacity: 0,
      };

      existing.availability.push(avail);
      existing.totalCapacity += avail.availableHours;
      map.set(dateKey, existing);
    });

    return map;
  }, [workloadData]);

  const dateCellRender = (date: Dayjs) => {
    const dateKey = date.format('YYYY-MM-DD');
    const workload = dateWorkloadMap.get(dateKey);

    // Check if the current date is within the selected date range filter
    const isWithinDateRange = date.isSameOrAfter(dayjs(dateRange.startDate), 'day') &&
                              date.isSameOrBefore(dayjs(dateRange.endDate), 'day');

    if (!workload || workload.allocations.length === 0 || !isWithinDateRange) {
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

    return (
      <Flex vertical gap={4} style={{ padding: 4 }}>
        <Badge status={status} text={`${Math.round(utilization)}%`} style={{ fontSize: 10 }} />

        {Object.entries(tasksByMember)
          .slice(0, 3)
          .map(([memberId, tasks]) => {
            const member = workloadData.members.find(m => m.id === memberId);
            if (!member) return null;

            return (
              <Tooltip
                key={memberId}
                title={
                  <div>
                    <div>{member.name}</div>
                    {tasks.map(task => (
                      <div key={task.id} style={{ fontSize: 11 }}>
                        • {task.taskName} ({task.estimatedHours}h)
                      </div>
                    ))}
                  </div>
                }
              >
                <Flex align="center" gap={4} style={{ cursor: 'pointer' }}>
                  <Avatar size={16} style={{ backgroundColor: token.colorPrimary }}>
                    {member.name.charAt(0)}
                  </Avatar>
                  <span style={{ fontSize: 10, color: token.colorTextSecondary }}>
                    {tasks.length} {t('calendar.tasks')}
                  </span>
                </Flex>
              </Tooltip>
            );
          })}

        {Object.keys(tasksByMember).length > 3 && (
          <Typography.Text style={{ fontSize: 10, color: token.colorTextSecondary }}>
            +{Object.keys(tasksByMember).length - 3} {t('calendar.more')}
          </Typography.Text>
        )}
      </Flex>
    );
  };

  const monthCellRender = (date: Dayjs) => {
    const monthStart = date.startOf('month');
    const monthEnd = date.endOf('month');
    let totalTasks = 0;
    let totalHours = 0;

    dateWorkloadMap.forEach((workload, dateKey) => {
      const workloadDate = dayjs(dateKey);
      if (workloadDate.isSameOrAfter(monthStart) && workloadDate.isSameOrBefore(monthEnd)) {
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
        title={t('calendar.dayDetails', { date: selectedDate.format('MMM DD, YYYY') })}
        style={{ width: 350 }}
      >
        {selectedDateWorkload && selectedDateWorkload.allocations.length > 0 ? (
          <Flex vertical gap={12}>
            <div>
              <Typography.Text type="secondary" style={{ color: token.colorTextSecondary }}>
                {t('calendar.utilization')}
              </Typography.Text>
              <Typography.Title level={4} style={{ color: token.colorText }}>
                {selectedDateWorkload.totalCapacity > 0
                  ? Math.round(
                      (selectedDateWorkload.totalHours / selectedDateWorkload.totalCapacity) * 100
                    )
                  : 0}
                %
              </Typography.Title>
            </div>

            <div>
              <Typography.Text type="secondary" style={{ color: token.colorTextSecondary }}>
                {t('calendar.assignedTasks')}
              </Typography.Text>
              <Flex vertical gap={8} style={{ marginTop: 8 }}>
                {selectedDateWorkload.allocations.map(task => {
                  const member = workloadData.members.find(m => m.id === task.memberId);
                  return (
                    <Flex key={task.id} align="center" gap={8}>
                      <Avatar size={24}>{member?.name.charAt(0) || 'U'}</Avatar>
                      <Flex vertical style={{ flex: 1 }}>
                        <Typography.Text ellipsis style={{ fontSize: 12, color: token.colorText }}>
                          {task.taskName}
                        </Typography.Text>
                        <Typography.Text
                          type="secondary"
                          style={{ fontSize: 11, color: token.colorTextSecondary }}
                        >
                          {member?.name} • {task.estimatedHours}h
                        </Typography.Text>
                      </Flex>
                      <Badge
                        color={task.statusColor || 'blue'}
                        text={task.status}
                        style={{ fontSize: 10 }}
                      />
                    </Flex>
                  );
                })}
              </Flex>
            </div>

            <div>
              <Typography.Text type="secondary" style={{ color: token.colorTextSecondary }}>
                {t('calendar.teamAvailability')}
              </Typography.Text>
              <Flex vertical gap={4} style={{ marginTop: 8 }}>
                {selectedDateWorkload.availability.map(avail => {
                  const member = workloadData.members.find(m => m.id === avail.memberId);
                  return (
                    <Flex key={avail.memberId} justify="space-between">
                      <Typography.Text style={{ fontSize: 12, color: token.colorText }}>
                        {member?.name}
                      </Typography.Text>
                      <Typography.Text style={{ fontSize: 12, color: token.colorText }}>
                        {avail.plannedHours}/{avail.availableHours}h
                      </Typography.Text>
                    </Flex>
                  );
                })}
              </Flex>
            </div>
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
