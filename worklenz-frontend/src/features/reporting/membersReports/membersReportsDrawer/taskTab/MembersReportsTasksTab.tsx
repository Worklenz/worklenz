import { Flex } from '@/shared/antd-imports';
import React, { useEffect, useMemo, useState } from 'react';
import CustomSearchbar from '../../../../../components/CustomSearchbar';
import { fetchData } from '@/utils/fetchData';
import MembersReportsTasksTable from './MembersReportsTasksTable';
import ProjectFilter from './ProjectFilter';
import { useTranslation } from 'react-i18next';
import { useAuthService } from '@/hooks/useAuth';
import { reportingApiService } from '@/api/reporting/reporting.api.service';
import { IRPTOverviewProject } from '@/types/reporting/reporting.types';
import { useAppSelector } from '@/hooks/useAppSelector';

const TaskDrawer = React.lazy(() => import('@components/task-drawer/task-drawer'));

type MembersReportsTasksTabProps = {
  memberId: string | null;
};

const MembersReportsTasksTab = ({ memberId }: MembersReportsTasksTabProps) => {
  const { t } = useTranslation('reporting-members-drawer');
  const currentSession = useAuthService().getCurrentSession();

  const { duration, dateRange } = useAppSelector(state => state.reportingReducer);
  const { archived } = useAppSelector(state => state.membersReportsReducer);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tasksList, setTasksList] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(false);
  const [projectsList, setProjectsList] = useState<IRPTOverviewProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    return tasksList.filter(task => task.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [tasksList, searchQuery]);

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

  const fetchTasks = async () => {
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
        false,
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
  };

  useEffect(() => {
    fetchProjects();
    fetchTasks();
  }, [selectedProjectId, duration, dateRange]);

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

      <TaskDrawer />
    </Flex>
  );
};

export default MembersReportsTasksTab;
