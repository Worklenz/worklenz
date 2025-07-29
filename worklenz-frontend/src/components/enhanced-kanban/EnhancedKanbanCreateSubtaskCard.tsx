import { Flex, Input, InputRef } from '@/shared/antd-imports';
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import { updateEnhancedKanbanTaskProgress } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { useAppSelector } from '@/hooks/useAppSelector';
import { getCurrentGroup } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { useAuthService } from '@/hooks/useAuth';
import { ITaskCreateRequest } from '@/types/tasks/task-create-request.types';
import { useParams } from 'react-router-dom';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import logger from '@/utils/errorLogger';

type EnhancedKanbanCreateSubtaskCardProps = {
  sectionId: string;
  parentTaskId: string;
  setShowNewSubtaskCard: (x: boolean) => void;
};

const EnhancedKanbanCreateSubtaskCard = ({
  sectionId,
  parentTaskId,
  setShowNewSubtaskCard,
}: EnhancedKanbanCreateSubtaskCardProps) => {
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
    if (groupBy === 'status') {
      body.status_id = sectionId || undefined;
    } else if (groupBy === 'priority') {
      body.priority_id = sectionId || undefined;
    } else if (groupBy === 'phase') {
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
        setCreatingTask(false);
        setNewSubtaskName('');
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
              dispatch(
                updateEnhancedKanbanTaskProgress({
                  id: task.id || '',
                  complete_ratio: data.complete_ratio,
                  completed_count: data.completed_count,
                  total_tasks_count: data.total_tasks_count,
                  parent_task: data.parent_task,
                })
              );
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
      gap={4}
      style={{
        width: '100%',
        padding: 2,
        backgroundColor: themeMode === 'dark' ? '#292929' : '#fafafa',
        borderRadius: 6,
        cursor: 'pointer',
        overflow: 'hidden',
      }}
      //   className={`outline-1 ${themeWiseColor('outline-[#edeae9]', 'outline-[#6a696a]', themeMode)} hover:outline`}
      onBlur={handleCancelNewCard}
    >
      <Input
        ref={inputRef}
        value={newSubtaskName}
        onClick={e => e.stopPropagation()}
        onChange={e => setNewSubtaskName(e.target.value)}
        onKeyDown={e => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            setIsEnterKeyPressed(true);
            handleAddSubtask();
          }
        }}
        onKeyUp={e => e.stopPropagation()}
        onKeyPress={e => e.stopPropagation()}
        onBlur={handleInputBlur}
        placeholder={t('newSubtaskNamePlaceholder')}
        className={`enhanced-kanban-create-subtask-input ${themeMode === 'dark' ? 'dark' : ''}`}
        disabled={creatingTask}
        autoFocus
      />
    </Flex>
  );
};

export default EnhancedKanbanCreateSubtaskCard;
