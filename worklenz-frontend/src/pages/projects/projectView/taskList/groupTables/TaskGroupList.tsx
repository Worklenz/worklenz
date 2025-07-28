import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Flex from 'antd/es/flex';
import Badge from 'antd/es/badge';
import Button from 'antd/es/button';
import ConfigProvider from 'antd/es/config-provider';
import Dropdown from 'antd/es/dropdown';
import Input from 'antd/es/input';
import Typography from 'antd/es/typography';
import { MenuProps } from 'antd/es/menu';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  EditOutlined,
  EllipsisOutlined,
  RetweetOutlined,
  RightOutlined,
} from '@/shared/antd-imports';

import { colors } from '@/styles/colors';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { useSocket } from '@/socket/socketContext';
import { useAuthService } from '@/hooks/useAuth';
import { fetchTaskAssignees, updateTaskAssignees } from '@/features/tasks/tasks.slice';
import { ITaskAssigneesUpdateResponse } from '@/types/tasks/task-assignee-update-response';
import { SocketEvents } from '@/shared/socket-events';
import logger from '@/utils/errorLogger';
import TaskListTable from '../task-list-table/task-list-table';
import Collapsible from '@/components/collapsible/collapsible';

import TaskTemplateDrawer from '@/components/task-templates/task-template-drawer';
import { createPortal } from 'react-dom';

interface TaskGroupListProps {
  taskGroups: ITaskListGroup[];
  groupBy: string;
}

const TaskGroupList = ({ taskGroups, groupBy }: TaskGroupListProps) => {
  const [groups, setGroups] = useState(taskGroups);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});

  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const currentSession = useAuthService().getCurrentSession();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { statusCategories } = useAppSelector(state => state.taskStatusReducer);
  const loadingAssignees = useAppSelector(state => state.taskReducer.loadingAssignees);
  const { t } = useTranslation('task-list-table');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // Initialize expanded state and names for new groups
  useEffect(() => {
    const newExpandedState = { ...expandedGroups };
    const newNames = { ...groupNames };
    taskGroups.forEach(group => {
      if (!(group.id in newExpandedState)) {
        newExpandedState[group.id] = true;
      }
      if (!(group.id in newNames)) {
        newNames[group.id] = group.name;
      }
    });
    setExpandedGroups(newExpandedState);
    setGroupNames(newNames);
    setGroups(taskGroups);
  }, [taskGroups]);

  // Socket listener for assignee updates
  useEffect(() => {
    if (!socket) return;

    const handleAssigneesUpdate = (data: ITaskAssigneesUpdateResponse) => {
      logger.info('change assignees response:- ', data);
      if (data) {
        const updatedAssignees = data.assignees.map(assignee => ({
          ...assignee,
          selected: true,
        }));

        const groupId = groups.find(group => group.tasks.some(task => task.id === data.id))?.id;

        if (groupId) {
          dispatch(
            updateTaskAssignees({
              groupId,
              taskId: data.id,
              assignees: updatedAssignees,
            })
          );

          if (currentSession?.team_id && !loadingAssignees) {
            dispatch(fetchTaskAssignees(currentSession.team_id));
          }
        }
      }
    };

    socket.on(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), handleAssigneesUpdate);
    return () => {
      socket.off(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), handleAssigneesUpdate);
    };
  }, [socket, currentSession?.team_id, loadingAssignees, groups]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeGroupId = active.data.current?.groupId;
    const overGroupId = over.data.current?.groupId;
    const activeTaskId = active.id;
    const overTaskId = over.id;

    setGroups(prevGroups => {
      // ... existing drag end logic ...
    });
  };

  const getDropdownItems = (groupId: string): MenuProps['items'] => [
    {
      key: '1',
      icon: <EditOutlined />,
      label: 'Rename',
      onClick: () => setRenamingGroup(groupId),
    },
    {
      key: '2',
      icon: <RetweetOutlined />,
      label: 'Change category',
      children: statusCategories?.map(status => ({
        key: status.id,
        label: (
          <Flex gap={8}>
            <Badge color={status.color_code} />
            {status.name}
          </Flex>
        ),
        type: 'group',
      })),
    },
  ];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <ConfigProvider
        wave={{ disabled: true }}
        theme={{
          components: {
            Select: {
              colorBorder: colors.transparent,
            },
          },
        }}
      >
        <Flex gap={24} vertical>
          {groups.map(group => (
            <div key={group.id}>
              <Flex vertical>
                <Flex style={{ transform: 'translateY(6px)' }}>
                  <Button
                    className="custom-collapse-button"
                    style={{
                      backgroundColor:
                        themeMode === 'dark' ? group.color_code_dark : group.color_code,
                      border: 'none',
                      borderBottomLeftRadius: expandedGroups[group.id] ? 0 : 4,
                      borderBottomRightRadius: expandedGroups[group.id] ? 0 : 4,
                      color: colors.darkGray,
                    }}
                    icon={<RightOutlined rotate={expandedGroups[group.id] ? 90 : 0} />}
                    onClick={() =>
                      setExpandedGroups(prev => ({ ...prev, [group.id]: !prev[group.id] }))
                    }
                  >
                    {renamingGroup === group.id ? (
                      <Input
                        size="small"
                        value={groupNames[group.id]}
                        onChange={e =>
                          setGroupNames(prev => ({ ...prev, [group.id]: e.target.value }))
                        }
                        onBlur={() => setRenamingGroup(null)}
                        onPressEnter={() => setRenamingGroup(null)}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <Typography.Text style={{ fontSize: 14, fontWeight: 600 }}>
                        {t(groupNames[group.id])} ({group.tasks.length})
                      </Typography.Text>
                    )}
                  </Button>
                  {groupBy === 'status' && !renamingGroup && (
                    <Dropdown menu={{ items: getDropdownItems(group.id) }}>
                      <Button icon={<EllipsisOutlined />} className="borderless-icon-btn" />
                    </Dropdown>
                  )}
                </Flex>
                <Collapsible
                  isOpen={expandedGroups[group.id]}
                  className="border-l-[3px] relative after:content after:absolute after:h-full after:w-1 after:z-10 after:top-0 after:left-0 mt-1"
                  color={themeMode === 'dark' ? group.color_code_dark : group.color_code}
                >
                  <TaskListTable taskList={group.tasks} tableId={group.id} activeId={activeId} />
                </Collapsible>
              </Flex>
            </div>
          ))}
        </Flex>
      </ConfigProvider>

      {createPortal(
        <TaskTemplateDrawer showDrawer={false} selectedTemplateId={''} onClose={() => {}} />,
        document.body,
        'task-template-drawer'
      )}
    </DndContext>
  );
};

export default TaskGroupList;
