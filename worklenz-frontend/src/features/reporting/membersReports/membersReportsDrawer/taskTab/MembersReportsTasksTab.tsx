import { Flex, Spin } from '@/shared/antd-imports';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import CustomSearchbar from '../../../../../components/CustomSearchbar';
import MembersReportsTasksTable from './MembersReportsTasksTable';
import ProjectFilter from './ProjectFilter';
import { useTranslation } from 'react-i18next';
import { useAuthService } from '@/hooks/useAuth';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { IRPTOverviewProject } from '@/types/reporting/reporting.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';

const TaskDrawer = React.lazy(() => import('@components/task-drawer/task-drawer'));

type MembersReportsTasksTabProps = {
  memberId: string | null;
};

const MembersReportsTasksTab = ({ memberId }: MembersReportsTasksTabProps) => {
  const { t } = useTranslation('reporting-members-drawer');
  const currentSession = useAuthService().getCurrentSession();
  const { socket } = useSocket();

  const { duration, dateRange } = useAppSelector(state => state.reportingReducer);
  const { archived, selectedStatType } = useAppSelector(state => state.membersReportsReducer);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tasksList, setTasksList] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(false);
  const [projectsList, setProjectsList] = useState<IRPTOverviewProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    let filtered = tasksList.filter(task => task.name.toLowerCase().includes(searchQuery.toLowerCase()));

    // Apply stat type filter if one is selected
    if (selectedStatType) {
      filtered = filtered.filter((task: any) => {
        switch (selectedStatType) {
          case 'completed':
            // Match tasks with "Done" status
            return task.status_name === 'Done';
          case 'ongoing':
            // Match tasks with "Doing" status
            return task.status_name === 'Doing';
          case 'overdue':
            // Match overdue tasks - check if days_overdue is greater than 0
            return task.days_overdue && task.days_overdue > 0;
          case 'assigned':
            // Assigned tasks are all tasks for the member
            return true;
          case 'total_tasks':
            // Total tasks are all tasks for the member
            return true;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [tasksList, searchQuery, selectedStatType]);

  const fetchProjects = async () => {
    if (!currentSession?.team_id) return;
    try {
      setLoadingProjects(true);
      const response = await reportingApiService.getOverviewProjectsByTeam(currentSession.team_id);
      if (response.done) {
        setProjectsList(response.body);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchTasks = React.useCallback(async () => {
    if (!currentSession?.team_id || !memberId) return;
    try {
      setLoadingTasks(true);
      const additionalBody = {
        duration: duration,
        date_range: dateRange,
        only_single_member: true,
        archived,
      };
      const response = await reportingApiService.getTasksByMember(
        memberId,
        selectedProjectId,
        true,  // onlySingleMember = true to apply duration filters
        null,
        additionalBody
      );
      if (response.done) {
        setTasksList(response.body);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingTasks(false);
    }
  }, [currentSession?.team_id, memberId, selectedProjectId, duration, dateRange, archived]);

  useEffect(() => {
    fetchProjects();
    fetchTasks();
  }, [fetchTasks]); // Add fetchTasks to dependency array since it's a useCallback

  // Real-time socket event handlers for task updates
  useEffect(() => {
    if (!socket) return;

    // Handle priority changes
    // Note: Backend sends priority_id, priority_value, and color_code, but NOT priority_name
    // We need to refetch tasks to get the updated priority_name from the server
    const handlePriorityChange = (data: { id: string; priority_id?: string; priority_value?: number; color_code?: string }) => {
      if (!data?.id) return;
      
      // Refetch tasks to ensure we get the correct priority_name from the backend
      // This is necessary because the socket event only contains priority_id and color_code,
      // not the human-readable priority_name
      fetchTasks();
    };

    // Handle end date (due date) changes
    const handleEndDateChange = (data: { id: string; end_date: string }) => {
      if (!data) return;
      setTasksList(prevTasks =>
        prevTasks.map(task =>
          task.id === data.id
            ? { ...task, end_date: data.end_date }
            : task
        )
      );
    };

    // Handle start date changes
    const handleStartDateChange = (data: { id: string; start_date: string }) => {
      if (!data) return;
      setTasksList(prevTasks =>
        prevTasks.map(task =>
          task.id === data.id
            ? { ...task, start_date: data.start_date }
            : task
        )
      );
    };

    // Handle status changes
    // Note: Backend sends status_id and color_code, not status_name
    // We need to refetch tasks to get the updated status_name from the server
    const handleStatusChange = (data: { id: string; status_id?: string; color_code?: string }) => {
      if (!data?.id) return;
      
      // Refetch tasks to ensure we get the correct status_name from the backend
      // This is necessary because the socket event only contains status_id and color_code,
      // not the human-readable status_name
      fetchTasks();
    };

    // Register socket event listeners
    socket.on(SocketEvents.TASK_PRIORITY_CHANGE.toString(), handlePriorityChange);
    socket.on(SocketEvents.TASK_END_DATE_CHANGE.toString(), handleEndDateChange);
    socket.on(SocketEvents.TASK_START_DATE_CHANGE.toString(), handleStartDateChange);
    socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), handleStatusChange);

    // Cleanup: remove event listeners when component unmounts
    return () => {
      socket.off(SocketEvents.TASK_PRIORITY_CHANGE.toString(), handlePriorityChange);
      socket.off(SocketEvents.TASK_END_DATE_CHANGE.toString(), handleEndDateChange);
      socket.off(SocketEvents.TASK_START_DATE_CHANGE.toString(), handleStartDateChange);
      socket.off(SocketEvents.TASK_STATUS_CHANGE.toString(), handleStatusChange);
    };
  }, [socket, fetchTasks]);

  return (
    <Flex vertical gap={24}>
      <Flex gap={24} align="center" justify="space-between">
        <CustomSearchbar
          placeholderText={t('searchByNameInputPlaceholder')}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        <ProjectFilter
          projectList={projectsList}
          loading={loadingProjects}
          onSelect={value => setSelectedProjectId(value)}
        />
      </Flex>

      <MembersReportsTasksTable tasksData={filteredTasks} loading={loadingTasks} />

      <Suspense fallback={<Spin size="small" />}>
        <TaskDrawer />
      </Suspense>
    </Flex>
  );
};

export default MembersReportsTasksTab;
