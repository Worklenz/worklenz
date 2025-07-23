import { Drawer, Tag, Typography, Flex, Table, Button, Tooltip, Skeleton } from 'antd/es';
import { useTranslation } from 'react-i18next';
import { useMemo, useState } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  fetchTaskGroups,
  IGroupBy,
  setConvertToSubtaskDrawerOpen,
  updateTaskStatus,
} from '@/features/tasks/tasks.slice';
import { RightOutlined } from '@/shared/antd-imports';
import CustomSearchbar from '@/components/CustomSearchbar';
import { ITaskListConfigV2, tasksApiService } from '@/api/tasks/tasks.api.service';
import { SocketEvents } from '@/shared/socket-events';
import { useSocket } from '@/socket/socketContext';
import { useAuthService } from '@/hooks/useAuth';
import logger from '@/utils/errorLogger';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { deselectAll } from '@/features/projects/bulkActions/bulkActionSlice';

const ConvertToSubtaskDrawer = () => {
  const { t } = useTranslation('task-list-table');
  const { socket, connected } = useSocket();
  const currentSession = useAuthService().getCurrentSession();

  const dispatch = useAppDispatch();
  const { convertToSubtaskDrawerOpen, groupBy } = useAppSelector(state => state.taskReducer);
  const selectedTask = useAppSelector(state => state.bulkActionReducer.selectedTasks[0]);
  const [searchText, setSearchText] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<boolean[]>([]);
  const [converting, setConverting] = useState(false);
  const [taskGroups, setTaskGroups] = useState<ITaskListGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const { projectId } = useAppSelector(state => state.projectReducer);

  const fetchTasks = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const config: ITaskListConfigV2 = {
        id: projectId,
        group: groupBy,
        field: null,
        order: null,
        search: null,
        statuses: null,
        members: null,
        projects: null,
        isSubtasksInclude: false,
      };

      const response = await tasksApiService.getTaskList(config);
      if (response.done) {
        setTaskGroups(response.body);
      }
    } catch (error) {
      logger.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (index: number) => {
    const newExpanded = [...expandedGroups];
    newExpanded[index] = !newExpanded[index];
    setExpandedGroups(newExpanded);
  };

  const handleStatusChange = (statusId: string) => {
    if (!selectedTask?.id || !statusId) return;

    socket?.emit(
      SocketEvents.TASK_STATUS_CHANGE.toString(),
      JSON.stringify({
        task_id: selectedTask?.id,
        status_id: statusId,
        team_id: currentSession?.team_id,
      })
    );
    socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), selectedTask?.id);
  };

  const handlePriorityChange = (priorityId: string) => {
    if (!selectedTask?.id || !priorityId) return;

    socket?.emit(
      SocketEvents.TASK_PRIORITY_CHANGE.toString(),
      JSON.stringify({
        task_id: selectedTask?.id,
        priority_id: priorityId,
        team_id: currentSession?.team_id,
      })
    );
  };

  const convertToSubTask = async (
    toGroupId: string | undefined,
    parentTaskId: string | undefined
  ) => {
    if (!toGroupId || !parentTaskId || !selectedTask?.id || !projectId) return;
    try {
      // setConverting(true);
      // if (groupBy === IGroupBy.STATUS) {
      //   handleStatusChange(toGroupId);
      // }
      // if (groupBy === IGroupBy.PRIORITY) {
      //   handlePriorityChange(toGroupId);
      // }

      const res = await tasksApiService.convertToSubtask(
        selectedTask?.id,
        projectId,
        parentTaskId,
        groupBy,
        toGroupId
      );
      if (res.done) {
        dispatch(deselectAll());
        dispatch(fetchTaskGroups(projectId));
        fetchTasks();
        dispatch(setConvertToSubtaskDrawerOpen(false));
      }
      setConverting(false);
    } catch (error) {
      logger.error('Error converting to subtask:', error);
    } finally {
      setConverting(false);
    }
  };

  const filteredTasks = useMemo(
    () =>
      taskGroups
        .map(group => ({
          ...group,
          tasks: group.tasks.filter(task =>
            task?.name?.toLowerCase().includes(searchText.toLowerCase())
          ),
        }))
        .filter(group => group.tasks.length > 0),
    [searchText, taskGroups]
  );

  return (
    <Drawer
      open={convertToSubtaskDrawerOpen}
      onClose={() => {
        dispatch(setConvertToSubtaskDrawerOpen(false));
        setSearchText('');
        setTaskGroups([]);
      }}
      title={t('contextMenu.convertToSubTask')}
      width={700}
      afterOpenChange={() => fetchTasks()}
    >
      <Flex vertical gap={12}>
        <CustomSearchbar
          searchQuery={searchText}
          setSearchQuery={setSearchText}
          placeholderText={t('contextMenu.searchByNameInputPlaceholder')}
        />
      </Flex>
      {loading ? (
        <Skeleton active className="mt-4" />
      ) : (
        filteredTasks.map((item, index) => (
          <div key={`group-${item.id}`}>
            <Button
              key={`group-button-${item.id}`}
              className="w-full"
              style={{
                backgroundColor: item.color_code,
                border: 'none',
                borderBottomLeftRadius: expandedGroups[index] ? 0 : 4,
                borderBottomRightRadius: expandedGroups[index] ? 0 : 4,
                color: '#000',
                marginTop: 8,
                justifyContent: 'flex-start',
                width: 'auto',
              }}
              onClick={() => toggleGroup(index)}
            >
              <Flex key={`group-flex-${item.id}`} align="center" gap={8}>
                <RightOutlined rotate={expandedGroups[index] ? 90 : 0} />
                <Typography.Text strong>{item.name}</Typography.Text>
              </Flex>
            </Button>
            <div
              key={`group-content-${item.id}`}
              style={{
                borderLeft: `3px solid ${item.color_code}`,
                transition: 'all 0.3s ease-in-out',
                maxHeight: expandedGroups[index] ? '2000px' : '0',
                opacity: expandedGroups[index] ? 1 : 0,
                overflow: expandedGroups[index] ? 'visible' : 'hidden',
              }}
            >
              <Table
                key={`group-table-${item.id}`}
                size="small"
                columns={[
                  {
                    title: '',
                    dataIndex: 'task_key',
                    key: 'task_key',
                    width: 100,
                    className: 'text-center',
                    render: (text: string) => <Tag key={`tag-${text}`}>{text}</Tag>,
                  },
                  {
                    title: 'Task',
                    dataIndex: 'name',
                    key: 'name',
                    render: (text: string) => (
                      <Tooltip title={text}>
                        <Typography.Text
                          style={{
                            width: 520,
                          }}
                          ellipsis={{ tooltip: text }}
                        >
                          {text}
                        </Typography.Text>
                      </Tooltip>
                    ),
                  },
                ]}
                dataSource={item.tasks.filter(
                  task => !task.parent_task_id && selectedTask?.id !== task.id
                )}
                pagination={false}
                scroll={{ x: 'max-content' }}
                onRow={record => {
                  return {
                    onClick: () => convertToSubTask(item.id, record.id),
                    style: { height: 38, cursor: 'pointer' },
                    className: 'group even:bg-[#4e4e4e10]',
                    key: `task-row-${record.id}`,
                  };
                }}
              />
            </div>
          </div>
        ))
      )}
    </Drawer>
  );
};

export default ConvertToSubtaskDrawer;
