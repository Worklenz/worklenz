import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDroppable } from '@dnd-kit/core';
import Flex from 'antd/es/flex';
import Badge from 'antd/es/badge';
import Button from 'antd/es/button';
import Dropdown from 'antd/es/dropdown';
import Input from 'antd/es/input';
import Typography from 'antd/es/typography';
import { MenuProps } from 'antd/es/menu';
import { EditOutlined, EllipsisOutlined, RetweetOutlined, RightOutlined } from '@/shared/antd-imports';

import { colors } from '@/styles/colors';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import Collapsible from '@/components/collapsible/collapsible';
import TaskListTable from '../../task-list-table/task-list-table';
import { IGroupBy, updateTaskGroupColor } from '@/features/tasks/tasks.slice';
import { useAuthService } from '@/hooks/useAuth';
import { statusApiService } from '@/api/taskAttributes/status/status.api.service';
import { phasesApiService } from '@/api/taskAttributes/phases/phases.api.service';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { fetchStatuses } from '@/features/taskAttributes/taskStatusSlice';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_project_board_column_setting_click } from '@/shared/worklenz-analytics-events';
import { ALPHA_CHANNEL } from '@/shared/constants';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import logger from '@/utils/errorLogger';

interface TaskGroupProps {
  taskGroup: ITaskListGroup;
  groupBy: string;
  color: string;
  activeId?: string | null;
}

const TaskGroup: React.FC<TaskGroupProps> = ({ taskGroup, groupBy, color, activeId }) => {
  const { t } = useTranslation('task-list-table');
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const isProjectManager = useIsProjectManager();
  const currentSession = useAuthService().getCurrentSession();

  const [isExpanded, setIsExpanded] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const [groupName, setGroupName] = useState(taskGroup.name || '');

  const { projectId } = useAppSelector((state: any) => state.projectReducer);
  const themeMode = useAppSelector((state: any) => state.themeReducer.mode);

  // Memoize droppable configuration
  const { setNodeRef } = useDroppable({
    id: taskGroup.id,
    data: {
      type: 'group',
      groupId: taskGroup.id,
    },
  });

  // Memoize task count
  const taskCount = useMemo(() => taskGroup.tasks?.length || 0, [taskGroup.tasks]);

  // Memoize dropdown items
  const dropdownItems: MenuProps['items'] = useMemo(() => {
    if (groupBy !== IGroupBy.STATUS || !isProjectManager) return [];

    return [
      {
        key: 'rename',
        label: t('renameText'),
        icon: <EditOutlined />,
        onClick: () => setIsRenaming(true),
      },
      {
        key: 'change-category',
        label: t('changeCategoryText'),
        icon: <RetweetOutlined />,
        children: [
          {
            key: 'todo',
            label: t('todoText'),
            onClick: () => handleStatusCategoryChange('0'),
          },
          {
            key: 'doing',
            label: t('doingText'),
            onClick: () => handleStatusCategoryChange('1'),
          },
          {
            key: 'done',
            label: t('doneText'),
            onClick: () => handleStatusCategoryChange('2'),
          },
        ],
      },
    ];
  }, [groupBy, isProjectManager, t]);

  const handleStatusCategoryChange = async (category: string) => {
    if (!projectId || !taskGroup.id) return;

    try {
      await statusApiService.updateStatus({
        id: taskGroup.id,
        category_id: category,
        project_id: projectId,
      });

      dispatch(fetchStatuses());
      trackMixpanelEvent(evt_project_board_column_setting_click, {
        column_id: taskGroup.id,
        action: 'change_category',
        category,
      });
    } catch (error) {
      logger.error('Error updating status category:', error);
    }
  };

  const handleRename = async () => {
    if (!projectId || !taskGroup.id || !groupName.trim()) return;

    try {
      if (groupBy === IGroupBy.STATUS) {
        await statusApiService.updateStatus({
          id: taskGroup.id,
          name: groupName.trim(),
          project_id: projectId,
        });
        dispatch(fetchStatuses());
      } else if (groupBy === IGroupBy.PHASE) {
        const phaseData: ITaskPhase = {
          id: taskGroup.id,
          name: groupName.trim(),
          project_id: projectId,
          color_code: taskGroup.color_code,
        };
        await phasesApiService.updatePhase(phaseData);
        dispatch(fetchPhasesByProjectId(projectId));
      }

      setIsRenaming(false);
    } catch (error) {
      logger.error('Error renaming group:', error);
    }
  };

  const handleColorChange = async (newColor: string) => {
    if (!projectId || !taskGroup.id) return;

    try {
      const baseColor = newColor.endsWith(ALPHA_CHANNEL)
        ? newColor.slice(0, -ALPHA_CHANNEL.length)
        : newColor;

      if (groupBy === IGroupBy.PHASE) {
        const phaseData: ITaskPhase = {
          id: taskGroup.id,
          name: taskGroup.name || '',
          project_id: projectId,
          color_code: baseColor,
        };
        await phasesApiService.updatePhase(phaseData);
        dispatch(fetchPhasesByProjectId(projectId));
      }

      dispatch(
        updateTaskGroupColor({
          groupId: taskGroup.id,
          color: baseColor,
        })
      );
    } catch (error) {
      logger.error('Error updating group color:', error);
    }
  };

  return (
    <div ref={setNodeRef}>
      <Flex vertical>
        {/* Group Header */}
        <Flex style={{ transform: 'translateY(6px)' }}>
          <Button
            className="custom-collapse-button"
            style={{
              backgroundColor: color,
              border: 'none',
              borderBottomLeftRadius: isExpanded ? 0 : 4,
              borderBottomRightRadius: isExpanded ? 0 : 4,
              color: colors.darkGray,
              minWidth: 200,
            }}
            icon={<RightOutlined rotate={isExpanded ? 90 : 0} />}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isRenaming ? (
              <Input
                size="small"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                onBlur={handleRename}
                onPressEnter={handleRename}
                onClick={e => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <Typography.Text style={{ fontSize: 14, fontWeight: 600 }}>
                {taskGroup.name} ({taskCount})
              </Typography.Text>
            )}
          </Button>

          {dropdownItems.length > 0 && !isRenaming && (
            <Dropdown menu={{ items: dropdownItems }} trigger={['click']}>
              <Button icon={<EllipsisOutlined />} className="borderless-icon-btn" />
            </Dropdown>
          )}
        </Flex>

        {/* Task List */}
        <Collapsible isOpen={isExpanded}>
          <TaskListTable
            taskList={taskGroup.tasks || []}
            tableId={taskGroup.id}
            groupBy={groupBy}
            color={color}
            activeId={activeId}
          />
        </Collapsible>
      </Flex>
    </div>
  );
};

export default React.memo(TaskGroup);
