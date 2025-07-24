import { useState, useCallback, useMemo } from 'react';
import {
  Tooltip,
  Tag,
  Progress,
  Typography,
  Dropdown,
  MenuProps,
  Button,
  Flex,
  List,
  Divider,
  Popconfirm,
  Skeleton,
} from '@/shared/antd-imports';
import {
  DoubleRightOutlined,
  PauseOutlined,
  UserAddOutlined,
  InboxOutlined,
  DeleteOutlined,
  MinusOutlined,
  ForkOutlined,
  CaretRightFilled,
  CaretDownFilled,
  ExclamationCircleFilled,
  PlusOutlined,
} from '@/shared/antd-imports';
import dayjs, { Dayjs } from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { themeWiseColor } from '@/utils/themeWiseColor';
import BoardSubTaskCard from '../board-sub-task-card/board-sub-task-card';
import CustomAvatarGroup from '@/components/board/custom-avatar-group';
import CustomDueDatePicker from '@/components/board/custom-due-date-picker';
import { colors } from '@/styles/colors';
import {
  deleteBoardTask,
  fetchBoardSubTasks,
  updateBoardTaskAssignee,
} from '@features/board/board-slice';
import BoardCreateSubtaskCard from '../board-sub-task-card/board-create-sub-task-card';
import { setShowTaskDrawer, setSelectedTaskId } from '@/features/task-drawer/task-drawer.slice';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { IBulkAssignRequest } from '@/types/tasks/bulk-action-bar.types';
import { taskListBulkActionsApiService } from '@/api/tasks/task-list-bulk-actions.api.service';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  evt_project_task_list_context_menu_archive,
  evt_project_task_list_context_menu_assign_me,
  evt_project_task_list_context_menu_delete,
} from '@/shared/worklenz-analytics-events';
import logger from '@/utils/errorLogger';
import { useAuthService } from '@/hooks/useAuth';
import PrioritySection from '@/components/board/taskCard/priority-section/priority-section';

interface IBoardViewTaskCardProps {
  task: IProjectTask;
  sectionId: string;
}

const BoardViewTaskCard = ({ task, sectionId }: IBoardViewTaskCardProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('kanban-board');
  const { trackMixpanelEvent } = useMixpanelTracking();
  const currentSession = useAuthService().getCurrentSession();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const [isSubTaskShow, setIsSubTaskShow] = useState(false);
  const [showNewSubtaskCard, setShowNewSubtaskCard] = useState(false);
  const [dueDate, setDueDate] = useState<Dayjs | null>(
    task?.end_date ? dayjs(task?.end_date) : null
  );
  const [updatingAssignToMe, setUpdatingAssignToMe] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id || '',
    data: {
      type: 'task',
      task,
      sectionId,
    },
  });

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }),
    [transform, transition, isDragging]
  );

  const handleCardClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      // Prevent the event from propagating to parent elements
      e.stopPropagation();

      // Don't handle click if we're dragging
      if (isDragging) return;

      // Add a small delay to ensure it's a click and not the start of a drag
      const clickTimeout = setTimeout(() => {
        dispatch(setSelectedTaskId(id));
        dispatch(setShowTaskDrawer(true));
      }, 50);

      return () => clearTimeout(clickTimeout);
    },
    [dispatch, isDragging]
  );

  const handleAssignToMe = useCallback(async () => {
    if (!projectId || !task.id || updatingAssignToMe) return;

    try {
      setUpdatingAssignToMe(true);
      const body: IBulkAssignRequest = {
        tasks: [task.id],
        project_id: projectId,
      };
      const res = await taskListBulkActionsApiService.assignToMe(body);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_context_menu_assign_me);
        dispatch(
          updateBoardTaskAssignee({
            body: res.body,
            sectionId,
            taskId: task.id,
          })
        );
      }
    } catch (error) {
      logger.error('Error assigning task to me:', error);
    } finally {
      setUpdatingAssignToMe(false);
    }
  }, [projectId, task.id, updatingAssignToMe, dispatch, trackMixpanelEvent, sectionId]);

  const handleArchive = useCallback(async () => {
    if (!projectId || !task.id) return;

    try {
      const res = await taskListBulkActionsApiService.archiveTasks(
        {
          tasks: [task.id],
          project_id: projectId,
        },
        false
      );

      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_context_menu_archive);
        dispatch(deleteBoardTask({ sectionId, taskId: task.id }));
      }
    } catch (error) {
      logger.error('Error archiving task:', error);
    }
  }, [projectId, task.id, dispatch, trackMixpanelEvent, sectionId]);

  const handleDelete = useCallback(async () => {
    if (!projectId || !task.id) return;

    try {
      const res = await taskListBulkActionsApiService.deleteTasks({ tasks: [task.id] }, projectId);

      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_context_menu_delete);
        dispatch(deleteBoardTask({ sectionId, taskId: task.id }));
      }
    } catch (error) {
      logger.error('Error deleting task:', error);
    }
  }, [projectId, task.id, dispatch, trackMixpanelEvent, sectionId]);

  const handleSubTaskExpand = useCallback(() => {
    if (task && task.id && projectId) {
      if (task.show_sub_tasks) {
        // If subtasks are already loaded, just toggle visibility
        setIsSubTaskShow(prev => !prev);
      } else {
        // If subtasks need to be fetched, show the section first with loading state
        setIsSubTaskShow(true);
        dispatch(fetchBoardSubTasks({ taskId: task.id, projectId }));
      }
    }
  }, [task, projectId, dispatch]);

  const handleAddSubtaskClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowNewSubtaskCard(true);
  }, []);

  const handleSubtaskButtonClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      handleSubTaskExpand();
    },
    [handleSubTaskExpand]
  );

  const items: MenuProps['items'] = useMemo(
    () => [
      {
        label: (
          <span>
            <UserAddOutlined />
            &nbsp;
            <Typography.Text>{t('assignToMe')}</Typography.Text>
          </span>
        ),
        key: '1',
        onClick: handleAssignToMe,
        disabled: updatingAssignToMe,
      },
      {
        label: (
          <span>
            <InboxOutlined />
            &nbsp;
            <Typography.Text>{t('archive')}</Typography.Text>
          </span>
        ),
        key: '2',
        onClick: handleArchive,
      },
      {
        label: (
          <Popconfirm
            title={t('deleteConfirmationTitle')}
            icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
            okText={t('deleteConfirmationOk')}
            cancelText={t('deleteConfirmationCancel')}
            onConfirm={handleDelete}
          >
            <DeleteOutlined />
            &nbsp;
            {t('delete')}
          </Popconfirm>
        ),
        key: '3',
      },
    ],
    [t, handleAssignToMe, handleArchive, handleDelete, updatingAssignToMe]
  );

  const renderLabels = useMemo(() => {
    if (!task?.labels?.length) return null;

    return (
      <>
        {task.labels.slice(0, 2).map((label: any) => (
          <Tag key={label.id} style={{ marginRight: '4px' }} color={label?.color_code}>
            <span style={{ color: themeMode === 'dark' ? '#383838' : '' }}>{label.name}</span>
          </Tag>
        ))}
        {task.labels.length > 2 && <Tag>+ {task.labels.length - 2}</Tag>}
      </>
    );
  }, [task.labels, themeMode]);

  return (
    <Flex
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      vertical
      gap={12}
      style={{
        ...style,
        width: '100%',
        padding: 12,
        backgroundColor: themeMode === 'dark' ? '#292929' : '#fafafa',
        borderRadius: 6,
        cursor: 'grab',
        overflow: 'hidden',
      }}
      className={`group outline-1 ${themeWiseColor('outline-[#edeae9]', 'outline-[#6a696a]', themeMode)} hover:outline-solid board-task-card`}
      data-id={task.id}
      data-dragging={isDragging ? 'true' : 'false'}
    >
      <Dropdown menu={{ items }} trigger={['contextMenu']}>
        {/* Task Card */}
        <Flex vertical gap={8} onClick={e => handleCardClick(e, task.id || '')}>
          {/* Labels and Progress */}
          <Flex align="center" justify="space-between">
            <Flex>{renderLabels}</Flex>

            <Tooltip title={` ${task?.completed_count} / ${task?.total_tasks_count}`}>
              <Progress
                type="circle"
                percent={task?.complete_ratio}
                size={26}
                strokeWidth={(task.complete_ratio || 0) >= 100 ? 9 : 7}
              />
            </Tooltip>
          </Flex>
          <Flex gap={4} align="center">
            {/* Action Icons */}
            <PrioritySection task={task} />
            <Typography.Text style={{ fontWeight: 500 }} ellipsis={{ tooltip: task.name }}>
              {task.name}
            </Typography.Text>
          </Flex>
          <Flex
            align="center"
            justify="space-between"
            style={{
              marginBlock: 8,
            }}
          >
            {task && <CustomAvatarGroup task={task} sectionId={sectionId} />}

            <Flex gap={4} align="center">
              <CustomDueDatePicker task={task} onDateChange={setDueDate} />

              {/* Subtask Section */}
              <Button
                onClick={handleSubtaskButtonClick}
                size="small"
                style={{
                  padding: 0,
                }}
                type="text"
              >
                <Tag
                  bordered={false}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    margin: 0,
                    backgroundColor: themeWiseColor('white', '#1e1e1e', themeMode),
                  }}
                >
                  <ForkOutlined rotate={90} />
                  <span>{task.sub_tasks_count}</span>
                  {isSubTaskShow ? <CaretDownFilled /> : <CaretRightFilled />}
                </Tag>
              </Button>
            </Flex>
          </Flex>
        </Flex>
      </Dropdown>
      {/* Subtask Section */}
      <Flex vertical gap={8}>
        {isSubTaskShow && (
          <Flex vertical>
            <Divider style={{ marginBlock: 0 }} />
            <List>
              {task.sub_tasks_loading && (
                <List.Item>
                  <Skeleton active paragraph={{ rows: 2 }} title={false} style={{ marginTop: 8 }} />
                </List.Item>
              )}

              {!task.sub_tasks_loading &&
                task?.sub_tasks &&
                task?.sub_tasks.map((subtask: any) => (
                  <BoardSubTaskCard key={subtask.id} subtask={subtask} sectionId={sectionId} />
                ))}

              {showNewSubtaskCard && (
                <BoardCreateSubtaskCard
                  sectionId={sectionId}
                  parentTaskId={task.id || ''}
                  setShowNewSubtaskCard={setShowNewSubtaskCard}
                />
              )}
            </List>
            <Button
              type="text"
              style={{
                width: 'fit-content',
                borderRadius: 6,
                boxShadow: 'none',
              }}
              icon={<PlusOutlined />}
              onClick={handleAddSubtaskClick}
            >
              {t('addSubtask', 'Add Subtask')}
            </Button>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
};

export default BoardViewTaskCard;
