import { useCallback, useState } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { Col, Flex, Typography, List, Dropdown, MenuProps, Popconfirm } from '@/shared/antd-imports';
import {
  UserAddOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
  InboxOutlined,
} from '@/shared/antd-imports';
import CustomAvatarGroup from '@/components/board/custom-avatar-group';
import CustomDueDatePicker from '@/components/board/custom-due-date-picker';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import { useTranslation } from 'react-i18next';
import { colors } from '@/styles/colors';
import { taskListBulkActionsApiService } from '@/api/tasks/task-list-bulk-actions.api.service';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  evt_project_task_list_context_menu_assign_me,
  evt_project_task_list_context_menu_delete,
  evt_project_task_list_context_menu_archive,
} from '@/shared/worklenz-analytics-events';
import logger from '@/utils/errorLogger';
import { useAppSelector } from '@/hooks/useAppSelector';
import { deleteBoardTask, updateBoardTaskAssignee } from '@features/board/board-slice';
import { IBulkAssignRequest } from '@/types/tasks/bulk-action-bar.types';

interface IBoardSubTaskCardProps {
  subtask: IProjectTask;
  sectionId: string;
}

const BoardSubTaskCard = ({ subtask, sectionId }: IBoardSubTaskCardProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('kanban-board');
  const { trackMixpanelEvent } = useMixpanelTracking();
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const [updatingAssignToMe, setUpdatingAssignToMe] = useState(false);
  const [subtaskDueDate, setSubtaskDueDate] = useState<Dayjs | null>(
    subtask?.end_date ? dayjs(subtask?.end_date) : null
  );

  const handleCardClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const clickTimeout = setTimeout(() => {
      dispatch(setSelectedTaskId(id));
      dispatch(setShowTaskDrawer(true));
    }, 50);
    return () => clearTimeout(clickTimeout);
  };

  const handleAssignToMe = useCallback(async () => {
    if (!projectId || !subtask.id || updatingAssignToMe) return;

    try {
      setUpdatingAssignToMe(true);
      const body: IBulkAssignRequest = {
        tasks: [subtask.id],
        project_id: projectId,
      };
      const res = await taskListBulkActionsApiService.assignToMe(body);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_context_menu_assign_me);
        dispatch(
          updateBoardTaskAssignee({
            body: res.body,
            sectionId,
            taskId: subtask.id,
          })
        );
      }
    } catch (error) {
      logger.error('Error assigning task to me:', error);
    } finally {
      setUpdatingAssignToMe(false);
    }
  }, [projectId, subtask.id, updatingAssignToMe, dispatch, trackMixpanelEvent, sectionId]);

  // const handleArchive = async () => {
  //   if (!projectId || !subtask.id) return;

  //   try {
  //     const res = await taskListBulkActionsApiService.archiveTasks(
  //       {
  //         tasks: [subtask.id],
  //         project_id: projectId,
  //       },
  //       false
  //     );

  //     if (res.done) {
  //       trackMixpanelEvent(evt_project_task_list_context_menu_archive);
  //       dispatch(deleteBoardTask({ sectionId, taskId: subtask.id }));
  //     }
  //   } catch (error) {
  //     logger.error('Error archiving subtask:', error);
  //   }
  // };

  const handleDelete = async () => {
    if (!projectId || !subtask.id) return;

    try {
      const res = await taskListBulkActionsApiService.deleteTasks(
        { tasks: [subtask.id] },
        projectId
      );
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_context_menu_delete);
        dispatch(deleteBoardTask({ sectionId, taskId: subtask.id }));
      }
    } catch (error) {
      logger.error('Error deleting subtask:', error);
    }
  };

  const items: MenuProps['items'] = [
    {
      label: (
        <span>
          <UserAddOutlined />
          &nbsp;
          <Typography.Text>{t('assignToMe')}</Typography.Text>
        </span>
      ),
      key: '1',
      onClick: () => handleAssignToMe(),
      disabled: updatingAssignToMe,
    },
    // {
    //   label: (
    //     <span>
    //       <InboxOutlined />
    //       &nbsp;
    //       <Typography.Text>{t('archive')}</Typography.Text>
    //     </span>
    //   ),
    //   key: '2',
    //   onClick: () => handleArchive(),
    // },
    {
      label: (
        <Popconfirm
          title={t('deleteConfirmationTitle')}
          icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
          okText={t('deleteConfirmationOk')}
          cancelText={t('deleteConfirmationCancel')}
          onConfirm={() => handleDelete()}
        >
          <DeleteOutlined />
          &nbsp;
          {t('delete')}
        </Popconfirm>
      ),
      key: '3',
    },
  ];

  return (
    <Dropdown menu={{ items }} trigger={['contextMenu']}>
      <List.Item
        key={subtask.id}
        className="group"
        style={{
          width: '100%',
        }}
        onClick={e => handleCardClick(e, subtask.id || '')}
      >
        <Col span={10}>
          <Typography.Text
            style={{ fontWeight: 500, fontSize: 14 }}
            delete={subtask.status === 'done'}
            ellipsis={{ expanded: false }}
          >
            {subtask.name}
          </Typography.Text>
        </Col>

        <Flex gap={8} justify="end" style={{ width: '100%' }}>
          <CustomAvatarGroup task={subtask} sectionId={sectionId} />
          <CustomDueDatePicker task={subtask} onDateChange={setSubtaskDueDate} />
        </Flex>
      </List.Item>
    </Dropdown>
  );
};

export default BoardSubTaskCard;
