import React, { useRef, useState, useEffect } from 'react';
import { Button, Flex, Input, InputRef } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { nanoid } from '@reduxjs/toolkit';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAuthService } from '@/hooks/useAuth';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { addTaskToGroup } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { ITaskCreateRequest } from '@/types/tasks/task-create-request.types';

interface EnhancedKanbanCreateTaskCardProps {
  sectionId: string;
  setShowNewCard: (x: boolean) => void;
  position?: 'top' | 'bottom';
}

const EnhancedKanbanCreateTaskCard: React.FC<EnhancedKanbanCreateTaskCardProps> = ({
  sectionId,
  setShowNewCard,
  position = 'bottom',
}) => {
  const { t } = useTranslation('kanban-board');
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const currentSession = useAuthService().getCurrentSession();

  const [newTaskName, setNewTaskName] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<InputRef>(null);

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const projectId = useAppSelector(state => state.projectReducer.projectId);
  const groupBy = useAppSelector(state => state.enhancedKanbanReducer.groupBy);

  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const createRequestBody = (): ITaskCreateRequest | null => {
    if (!projectId || !currentSession) return null;
    const body: ITaskCreateRequest = {
      project_id: projectId,
      name: newTaskName.trim(),
      reporter_id: currentSession.id,
      team_id: currentSession.team_id,
    };
    if (groupBy === 'status') body.status_id = sectionId;
    else if (groupBy === 'priority') body.priority_id = sectionId;
    else if (groupBy === 'phase') body.phase_id = sectionId;
    return body;
  };

  const resetForm = () => {
    setNewTaskName('');
    setCreatingTask(false);
    setShowNewCard(false);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const resetForNextTask = () => {
    setNewTaskName('');
    setCreatingTask(false);
    // Keep the card visible for creating the next task
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleAddTask = async () => {
    if (creatingTask || !projectId || !currentSession || newTaskName.trim() === '') return;

    const body = createRequestBody();
    if (!body) {
      setCreatingTask(true);
      setShowNewCard(true);
      return;
    }

    // Real-time socket event handler
    const eventHandler = (task: IProjectTask) => {
      // Only reset the form - the global handler will add the task to Redux
      socket?.off(SocketEvents.QUICK_TASK.toString(), eventHandler);
      resetForNextTask();
    };
    socket?.once(SocketEvents.QUICK_TASK.toString(), eventHandler);
    socket?.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));
  };

  const handleCancel = () => {
    setNewTaskName('');
    setShowNewCard(false);
    setCreatingTask(false);
  };

  const handleBlur = () => {
    if (newTaskName.trim() === '') {
      setCreatingTask(false);
      setShowNewCard(false);
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
        backgroundColor: themeWiseColor('#fafafa', '#292929', themeMode),
        borderRadius: 6,
        cursor: 'pointer',
        overflow: 'hidden',
        minHeight: 100,
        zIndex: 1,
        boxShadow: themeMode === 'dark' ? '0 2px 8px #1118' : '0 2px 8px #ccc8',
        marginBottom: 8,
        marginTop: 8,
      }}
      className={`outline-1 ${themeWiseColor('outline-[#edeae9]', 'outline-[#6a696a]', themeMode)} hover:outline-solid`}
    >
      <Input
        ref={inputRef}
        autoFocus
        value={newTaskName}
        onChange={e => setNewTaskName(e.target.value)}
        onPressEnter={handleAddTask}
        onBlur={handleBlur}
        placeholder={t('newTaskNamePlaceholder')}
        style={{
          width: '100%',
          borderRadius: 6,
          padding: 8,
        }}
        disabled={creatingTask}
      />
      {newTaskName.trim() && (
        <Flex gap={8} justify="flex-end">
          <Button size="small" onClick={handleCancel}>
            {t('cancel')}
          </Button>
          <Button type="primary" size="small" onClick={handleAddTask} loading={creatingTask}>
            {t('addTask')}
          </Button>
        </Flex>
      )}
    </Flex>
  );
};

export default EnhancedKanbanCreateTaskCard;
