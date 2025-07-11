import { Flex } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
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

      {createPortal(<TaskDrawer />, document.body, 'task-drawer')}
    </Flex>
  );
};

export default ProjectReportsTasksTab;
