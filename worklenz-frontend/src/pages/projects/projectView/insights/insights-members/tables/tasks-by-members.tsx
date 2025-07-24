import { useEffect, useState } from 'react';
import { Flex, Progress } from '@/shared/antd-imports';
import { colors } from '@/styles/colors';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { DownOutlined, ExclamationCircleOutlined, RightOutlined } from '@/shared/antd-imports';
import logger from '@/utils/errorLogger';
import { projectsApiService } from '@/api/projects/projects.api.service';
import { useTranslation } from 'react-i18next';
import { IProjectOverviewStats } from '@/types/project/projectsViewModel.types';
import { ITeamMemberOverviewGetResponse } from '@/types/project/project-insights.types';
import React from 'react';
import AssignedTasksListTable from './assigned-tasks-list';

const TaskByMembersTable = () => {
  const { includeArchivedTasks, projectId } = useAppSelector(state => state.projectInsightsReducer);

  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [memberList, setMemberList] = useState<ITeamMemberOverviewGetResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const { refreshTimestamp } = useAppSelector(state => state.projectReducer);

  const { t } = useTranslation('project-view-insights');

  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const getProjectOverviewMembers = async () => {
    if (!projectId) return;
    try {
      const res = await projectsApiService.getOverViewMembersById(projectId);
      if (res.done) {
        setMemberList(res.body);
      }
    } catch (error) {
      logger.error('Error fetching member tasks:', error);
    } finally {
      setLoading(false);
    }
    setLoading(true);
  };

  useEffect(() => {
    getProjectOverviewMembers();
  }, [projectId, refreshTimestamp]);

  // toggle members row expansions
  const toggleRowExpansion = (memberId: string) => {
    setExpandedRows(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  // columns list
  const columnsList = [
    { key: 'name', columnHeader: t('members.name'), width: 200 },
    { key: 'taskCount', columnHeader: t('members.taskCount'), width: 100 },
    { key: 'contribution', columnHeader: t('members.contribution'), width: 120 },
    { key: 'completed', columnHeader: t('members.completed'), width: 100 },
    { key: 'incomplete', columnHeader: t('members.incomplete'), width: 100 },
    { key: 'overdue', columnHeader: t('members.overdue'), width: 100 },
    { key: 'progress', columnHeader: t('members.progress'), width: 150 },
  ];

  // render content, based on column type
  const renderColumnContent = (key: string, member: ITeamMemberOverviewGetResponse) => {
    switch (key) {
      case 'name':
        return (
          <Flex gap={8} align="center">
            {member?.task_count && (
              <button onClick={() => toggleRowExpansion(member.id)}>
                {expandedRows.includes(member.id) ? <DownOutlined /> : <RightOutlined />}
              </button>
            )}
            {member.overdue_task_count ? (
              <ExclamationCircleOutlined style={{ color: colors.vibrantOrange }} />
            ) : (
              <div style={{ width: 14, height: 14 }}></div>
            )}
            {member.name}
          </Flex>
        );
      case 'taskCount':
        return member.task_count;
      case 'contribution':
        return `${member.contribution}%`;
      case 'completed':
        return member.done_task_count;
      case 'incomplete':
        return member.pending_task_count;
      case 'overdue':
        return member.overdue_task_count;
      case 'progress':
        return (
          <Progress
            percent={Math.floor(((member.done_task_count ?? 0) / (member.task_count ?? 1)) * 100)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="memberList-container min-h-0 max-w-full overflow-x-auto">
      <table className="w-full min-w-max border-collapse rounded-sm">
        <thead
          style={{
            height: 42,
            backgroundColor: themeWiseColor('#f8f7f9', '#1d1d1d', themeMode),
          }}
        >
          <tr>
            {columnsList.map(column => (
              <th
                key={column.key}
                className={`p-2`}
                style={{ width: column.width, fontWeight: 500 }}
              >
                {column.columnHeader}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {memberList?.map(member => (
            <React.Fragment key={member.id}>
              <tr key={member.id} className="h-[42px] cursor-pointer">
                {columnsList.map(column => (
                  <td
                    key={column.key}
                    className={`border-t p-2 text-center`}
                    style={{
                      width: column.width,
                    }}
                  >
                    {renderColumnContent(column.key, member)}
                  </td>
                ))}
              </tr>

              {expandedRows.includes(member.id) && (
                <tr>
                  <td colSpan={columnsList.length}>
                    <AssignedTasksListTable
                      memberId={member.id}
                      projectId={projectId}
                      archived={includeArchivedTasks}
                    />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TaskByMembersTable;
