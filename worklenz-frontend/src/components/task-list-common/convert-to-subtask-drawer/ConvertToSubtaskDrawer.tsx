import {
  Drawer,
  Tag,
  Typography,
  Flex,
  Table,
  Button,
  Tooltip,
  Skeleton,
  message,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useMemo, useState } from 'react';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  fetchTaskGroups,
  setConvertToSubtaskDrawerOpen,
} from '@/features/tasks/tasks.slice';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { RightOutlined } from '@/shared/antd-imports';
import CustomSearchbar from '@/components/CustomSearchbar';
import { ITaskListConfigV2, tasksApiService } from '@/api/tasks/tasks.api.service';
import logger from '@/utils/errorLogger';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { deselectAll } from '@/features/projects/bulkActions/bulkActionSlice';

const ConvertToSubtaskDrawer = () => {
  const { t } = useTranslation('task-list-table');

  const dispatch = useAppDispatch();
  const { convertToSubtaskDrawerOpen, convertToSubtaskDrawerMode, groupBy } = useAppSelector(
    state => state.taskReducer
  );
  const selectedTask = useAppSelector(state => state.bulkActionReducer.selectedTasks[0]);
  const [searchText, setSearchText] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<boolean[]>([]);
  const [converting, setConverting] = useState(false);
  const [taskGroups, setTaskGroups] = useState<ITaskListGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const { projectId } = useAppSelector(state => state.projectReducer);

  const isMoveMode = convertToSubtaskDrawerMode === 'move';

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

  const closeDrawer = () => {
    dispatch(setConvertToSubtaskDrawerOpen(false));
    setSearchText('');
    setTaskGroups([]);
    setExpandedGroups([]);
  };

  const convertToSubTask = async (
    toGroupId: string | undefined,
    parentTaskId: string | undefined
  ) => {
    if (!parentTaskId || !selectedTask?.id || !projectId) return;
    if (!isMoveMode && !toGroupId) return;
    try {
      setConverting(true);

      const res = isMoveMode
        ? await tasksApiService.moveSubtask(selectedTask.id, projectId, parentTaskId)
        : await tasksApiService.convertToSubtask(
            selectedTask.id,
            projectId,
            parentTaskId,
            groupBy,
            toGroupId as string
          );

      if (res.done) {
        dispatch(deselectAll());
        // Refresh the legacy tasks slice (still used by some views/reports)
        dispatch(fetchTaskGroups(projectId));
        // Refresh the task-management slice — this is the one TaskListV2Section
        // actually reads from, so without this the UI stays stale until refresh.
        dispatch(fetchTasksV3(projectId));
        closeDrawer();
        message.success(
          isMoveMode
            ? t('contextMenu.moveSubtaskSuccess', {
                defaultValue: 'Subtask moved successfully',
              })
            : t('contextMenu.convertToSubTaskSuccess', {
                defaultValue: 'Task converted to subtask successfully',
              })
        );
      } else if (res.message) {
        message.error(res.message);
      }
    } catch (error) {
      logger.error(isMoveMode ? 'Error moving subtask:' : 'Error converting to subtask:', error);
      message.error(
        isMoveMode
          ? t('contextMenu.moveSubtaskFailed', {
              defaultValue: 'Failed to move subtask',
            })
          : t('contextMenu.convertToSubTaskFailed', {
              defaultValue: 'Failed to convert to subtask',
            })
      );
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

  const getSelectableTasks = (groupTasks: typeof filteredTasks[number]['tasks']) =>
    groupTasks.filter(task => {
      if (task.parent_task_id) return false;
      if (selectedTask?.id === task.id) return false;
      // When moving, exclude the current parent — selecting it would be a no-op
      if (isMoveMode && selectedTask?.parent_task_id && task.id === selectedTask.parent_task_id) {
        return false;
      }
      return true;
    });

  return (
    <Drawer
      open={convertToSubtaskDrawerOpen}
      onClose={closeDrawer}
      title={
        isMoveMode
          ? t('contextMenu.moveSubtask', { defaultValue: 'Move to parent task' })
          : t('contextMenu.convertToSubTask')
      }
      width={700}
      afterOpenChange={open => {
        if (open) fetchTasks();
      }}
    >
      <Flex vertical gap={12}>
        <Typography.Text type="secondary">
          {isMoveMode
            ? t('contextMenu.moveSubtaskDescription', {
                defaultValue:
                  'Select a parent task in this project. The subtask keeps its title, description, assignee, dates, status, and logged hours.',
              })
            : t('contextMenu.convertToSubTaskDescription', {
                defaultValue: 'Select a parent task to convert this task into a subtask.',
              })}
        </Typography.Text>
        <CustomSearchbar
          searchQuery={searchText}
          setSearchQuery={setSearchText}
          placeholderText={t('contextMenu.searchByNameInputPlaceholder')}
        />
      </Flex>
      {loading ? (
        <Skeleton active className="mt-4" />
      ) : (
        filteredTasks.map((item, index) => {
          const selectableTasks = getSelectableTasks(item.tasks);
          if (selectableTasks.length === 0) return null;

          return (
            <div key={`group-${item.id}`}>
              <Button
                key={`group-button-${item.id}`}
                className="w-full"
                disabled={converting}
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
                      title: t('contextMenu.taskColumn', { defaultValue: 'Task' }),
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
                  dataSource={selectableTasks}
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  loading={converting}
                  onRow={record => {
                    return {
                      onClick: () => {
                        if (!converting) convertToSubTask(item.id, record.id);
                      },
                      style: { height: 38, cursor: converting ? 'not-allowed' : 'pointer' },
                      className: 'group even:bg-[#4e4e4e10]',
                      key: `task-row-${record.id}`,
                    };
                  }}
                />
              </div>
            </div>
          );
        })
      )}
    </Drawer>
  );
};

export default ConvertToSubtaskDrawer;
