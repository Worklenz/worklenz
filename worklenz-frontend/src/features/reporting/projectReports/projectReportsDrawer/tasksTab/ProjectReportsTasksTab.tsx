import { Flex, Spin } from '@/shared/antd-imports';
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import CustomSearchbar from '@components/CustomSearchbar';
import GroupByFilter from './group-by-filter';
import ProjectReportsTasksTable from './ProjectReportsTaskTable';
import { fetchData } from '@/utils/fetchData';
import { useTranslation } from 'react-i18next';
import logger from '@/utils/errorLogger';
import { reportingProjectsApiService } from '@/api/reporting/reporting-projects.api.service';
import { IGroupByOption, ITaskListGroup } from '@/types/tasks/taskList.types';
import { GROUP_BY_STATUS_VALUE, IGroupBy } from '@/features/board/board-slice';
import { createPortal } from 'react-dom';
import { useAppSelector } from '@/hooks/useAppSelector';

const TaskDrawer = React.lazy(() => import('@components/task-drawer/task-drawer'));

type ProjectReportsTasksTabProps = {
  projectId?: string | null;
};

const ProjectReportsTasksTab = ({ projectId = null }: ProjectReportsTasksTabProps) => {
  const [searchQuery, setSearhQuery] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [groups, setGroups] = useState<ITaskListGroup[]>([]);
  const [groupBy, setGroupBy] = useState<IGroupBy>(GROUP_BY_STATUS_VALUE);

  const { t } = useTranslation('reporting-projects-drawer');
  const lastDeletedTaskId = useAppSelector(state => state.taskDrawerReducer.lastDeletedTaskId);
  const isTaskDrawerOpen = useAppSelector(state => state.taskDrawerReducer.showTaskDrawer);
  const wasTaskDrawerOpenRef = useRef(isTaskDrawerOpen);

  useEffect(() => {
    if (!lastDeletedTaskId) return;
    setGroups(prev => removeTaskFromGroups(prev, lastDeletedTaskId));
  }, [lastDeletedTaskId]);

  const filteredGroups = useMemo(() => {
    return groups
      .filter(item => item.tasks.length > 0)
      .map(item => ({
        ...item,
        tasks: item.tasks.filter(task =>
          task.name?.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      }))
      .filter(item => item.tasks.length > 0);
  }, [groups, searchQuery]);

  const fetchTasksData = async () => {
    if (!projectId || loading) return;

    try {
      setLoading(true);
      const res = await reportingProjectsApiService.getTasks(projectId, groupBy);
      if (res.done) {
        setGroups(res.body);
      }
    } catch (error) {
      logger.error('Error fetching tasks data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasksData();
  }, [projectId, groupBy]);

  useEffect(() => {
    const wasTaskDrawerOpen = wasTaskDrawerOpenRef.current;
    wasTaskDrawerOpenRef.current = isTaskDrawerOpen;
    if (wasTaskDrawerOpen && !isTaskDrawerOpen) fetchTasksData();
  }, [isTaskDrawerOpen]);

  return (
    <Flex vertical gap={24}>
      <Flex gap={24} align="center" justify="space-between">
        <CustomSearchbar
          placeholderText={t('searchByNameInputPlaceholder')}
          searchQuery={searchQuery}
          setSearchQuery={setSearhQuery}
        />
        <GroupByFilter setActiveGroup={setGroupBy} />
      </Flex>

      <Flex vertical gap={12}>
        {filteredGroups.map(item => (
          <ProjectReportsTasksTable
            key={item.id}
            tasksData={item.tasks}
            title={item.name}
            color={item.color_code}
            type={groupBy}
            projectId={projectId || ''}
          />
        ))}
      </Flex>

      {createPortal(
        <Suspense fallback={<Spin size="small" />}>
          <TaskDrawer />
        </Suspense>,
        document.body,
        'task-drawer'
      )}
    </Flex>
  );
};

const removeTaskFromGroups = (groups: ITaskListGroup[], taskId: string): ITaskListGroup[] =>
  groups.map(group => ({
    ...group,
    tasks: group.tasks.filter(task => task.id !== taskId && task.parent_task_id !== taskId),
  }));

export default ProjectReportsTasksTab;
