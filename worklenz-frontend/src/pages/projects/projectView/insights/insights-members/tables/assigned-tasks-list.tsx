import React, { useEffect, useState } from 'react';
import { Flex, Tooltip, Typography } from '@/shared/antd-imports';

import { projectInsightsApiService } from '@/api/projects/insights/project-insights.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IInsightTasks } from '@/types/project/projectInsights.types';
import { colors } from '@/styles/colors';
import { simpleDateFormat } from '@/utils/simpleDateFormat';
import { themeWiseColor } from '@/utils/themeWiseColor';

interface AssignedTasksListTableProps {
  memberId: string;
  projectId: string;
  archived: boolean;
}

const columnsList = [
  { key: 'name', columnHeader: 'Name', width: 280 },
  { key: 'status', columnHeader: 'Status', width: 100 },
  { key: 'dueDate', columnHeader: 'Due Date', width: 150 },
  { key: 'overdue', columnHeader: 'Days Overdue', width: 150 },
  { key: 'completedDate', columnHeader: 'Completed Date', width: 150 },
  { key: 'totalAllocation', columnHeader: 'Total Allocation', width: 150 },
  { key: 'overLoggedTime', columnHeader: 'Over Logged Time', width: 150 },
];

const AssignedTasksListTable: React.FC<AssignedTasksListTableProps> = ({
  memberId,
  projectId,
  archived,
}) => {
  const [memberTasks, setMemberTasks] = useState<IInsightTasks[]>([]);
  const [loading, setLoading] = useState(true);

  const themeMode = useAppSelector(state => state.themeReducer.mode);

  useEffect(() => {
    const getTasksByMemberId = async () => {
      setLoading(true);
      try {
        const res = await projectInsightsApiService.getMemberTasks({
          member_id: memberId,
          project_id: projectId,
          archived,
        });
        if (res.done) {
          setMemberTasks(res.body);
        }
      } catch (error) {
        console.error('Error fetching member tasks:', error);
      } finally {
        setLoading(false);
      }
    };

    getTasksByMemberId();
  }, [memberId, projectId, archived]);

  const renderColumnContent = (key: string, task: IInsightTasks) => {
    switch (key) {
      case 'name':
        return (
          <Tooltip title={task.name}>
            <Typography.Text>{task.name}</Typography.Text>
          </Tooltip>
        );
      case 'status':
        return (
          <Flex
            gap={4}
            style={{
              width: 'fit-content',
              borderRadius: 24,
              paddingInline: 6,
              backgroundColor: task.status_color,
              color: colors.darkGray,
              cursor: 'pointer',
            }}
          >
            <Typography.Text
              ellipsis={{ expanded: false }}
              style={{
                color: colors.darkGray,
                fontSize: 13,
              }}
            >
              {task.status}
            </Typography.Text>
          </Flex>
        );
      case 'dueDate':
        return task.end_date ? simpleDateFormat(task.end_date) : 'N/A';
      case 'overdue':
        return task.days_overdue ?? 'N/A';
      case 'completedDate':
        return task.completed_at ? simpleDateFormat(task.completed_at) : 'N/A';
      case 'totalAllocation':
        return task.total_minutes ?? 'N/A';
      case 'overLoggedTime':
        return task.overlogged_time ?? 'N/A';
      default:
        return null;
    }
  };

  return (
    <div
      className="min-h-0 max-w-full overflow-x-auto py-2 pl-12 pr-4"
      style={{ backgroundColor: themeWiseColor('#f0f2f5', '#000', themeMode) }}
    >
      <table className="w-full min-w-max border-collapse">
        <thead>
          <tr>
            {columnsList.map(column => (
              <th
                key={column.key}
                className="p-2 text-left"
                style={{ width: column.width, fontWeight: 500 }}
              >
                {column.columnHeader}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {memberTasks.map(task => (
            <tr key={task.id} className="h-[42px] border-t">
              {columnsList.map(column => (
                <td key={column.key} className="p-2" style={{ width: column.width }}>
                  {renderColumnContent(column.key, task)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AssignedTasksListTable;
