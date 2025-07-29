import { Flex, Input, InputRef } from '@/shared/antd-imports';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  addSubtask,
  GROUP_BY_PHASE_VALUE,
  GROUP_BY_PRIORITY_VALUE,
  GROUP_BY_STATUS_VALUE,
  updateSubtask,
  updateTaskProgress,
} from '@features/board/board-slice';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { useAppSelector } from '@/hooks/useAppSelector';
import { getCurrentGroup } from '@/features/tasks/tasks.slice';
import { useAuthService } from '@/hooks/useAuth';
import { ITaskCreateRequest } from '@/types/tasks/task-create-request.types';
import { useParams } from 'react-router-dom';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import logger from '@/utils/errorLogger';

type BoardCreateSubtaskCardProps = {
  sectionId: string;
  parentTaskId: string;
  setShowNewSubtaskCard: (x: boolean) => void;
};

const BoardCreateSubtaskCard = ({
  sectionId,
  parentTaskId,
  setShowNewSubtaskCard,
}: BoardCreateSubtaskCardProps) => {
  const { socket, connected } = useSocket();
  const dispatch = useAppDispatch();

  const [creatingTask, setCreatingTask] = useState<boolean>(false);
  const [newSubtaskName, setNewSubtaskName] = useState<string>('');
  const [isEnterKeyPressed, setIsEnterKeyPressed] = useState<boolean>(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<InputRef>(null);

  const { t } = useTranslation('kanban-board');

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { projectId } = useParams();
  const currentSession = useAuthService().getCurrentSession();

  const createRequestBody = (): ITaskCreateRequest | null => {
    if (!projectId || !currentSession) return null;
    const body: ITaskCreateRequest = {
      project_id: projectId,
      name: newSubtaskName,
      reporter_id: currentSession.id,
      team_id: currentSession.team_id,
    };

    const groupBy = getCurrentGroup();
    if (groupBy.value === GROUP_BY_STATUS_VALUE) {
      body.status_id = sectionId || undefined;
    } else if (groupBy.value === GROUP_BY_PRIORITY_VALUE) {
      body.priority_id = sectionId || undefined;
    } else if (groupBy.value === GROUP_BY_PHASE_VALUE) {
      body.phase_id = sectionId || undefined;
    }

    if (parentTaskId) {
      body.parent_task_id = parentTaskId;
    }
    return body;
  };

  const handleAddSubtask = () => {
    if (creatingTask || !projectId || !currentSession || newSubtaskName.trim() === '' || !connected)
      return;

    try {
      setCreatingTask(true);
      const body = createRequestBody();
      if (!body) return;

      socket?.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));
      socket?.once(SocketEvents.QUICK_TASK.toString(), (task: IProjectTask) => {
        if (!task) return;

        dispatch(updateSubtask({ sectionId, subtask: task, mode: 'add' }));
        setCreatingTask(false);
        // Clear the input field after successful task creation
        setNewSubtaskName('');
        // Focus back to the input field for adding another subtask
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
        if (task.parent_task_id) {
          socket?.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.parent_task_id);
          socket?.once(
            SocketEvents.GET_TASK_PROGRESS.toString(),
            (data: {
              id: string;
              complete_ratio: number;
              completed_count: number;
              total_tasks_count: number;
              parent_task: string;
            }) => {
              if (!data.parent_task) data.parent_task = task.parent_task_id || '';
              dispatch(updateTaskProgress(data));
            }
          );
        }
      });
    } catch (error) {
      logger.error('Error adding task:', error);
      setCreatingTask(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setIsEnterKeyPressed(true);
      handleAddSubtask();
    }
  };

  const handleInputBlur = () => {
    if (!isEnterKeyPressed && newSubtaskName.length > 0) {
      handleAddSubtask();
    }
    setIsEnterKeyPressed(false);
  };

  const handleCancelNewCard = (e: React.FocusEvent<HTMLDivElement>) => {
    if (cardRef.current && !cardRef.current.contains(e.relatedTarget)) {
      setNewSubtaskName('');
      setShowNewSubtaskCard(false);
    }
  };

  return (
    <Flex
      ref={cardRef}
      vertical
      gap={12}
      style={{
        width: '100%',
        padding: 12,
        backgroundColor: themeMode === 'dark' ? '#292929' : '#fafafa',
        borderRadius: 6,
        cursor: 'pointer',
        overflow: 'hidden',
      }}
      className={`outline-1 ${themeWiseColor('outline-[#edeae9]', 'outline-[#6a696a]', themeMode)} hover:outline-solid`}
      onBlur={handleCancelNewCard}
    >
      <Input
        ref={inputRef}
        autoFocus
        value={newSubtaskName}
        onChange={e => setNewSubtaskName(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleInputBlur}
        placeholder={t('newSubtaskNamePlaceholder')}
        style={{
          width: '100%',
          borderRadius: 6,
          padding: 8,
        }}
      />
    </Flex>
  );
};

export default BoardCreateSubtaskCard;
