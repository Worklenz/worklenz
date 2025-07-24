import { Button, Flex, Input, InputRef } from '@/shared/antd-imports';
import React, { useRef, useState, useEffect } from 'react';
import { Dayjs } from 'dayjs';
import { nanoid } from '@reduxjs/toolkit';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  addTaskCardToTheBottom,
  addTaskCardToTheTop,
  getCurrentGroupBoard,
  GROUP_BY_STATUS_VALUE,
  GROUP_BY_PRIORITY_VALUE,
  GROUP_BY_PHASE_VALUE,
} from '@features/board/board-slice';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { useAppSelector } from '@/hooks/useAppSelector';
import CustomDueDatePicker from '@/components/board/custom-due-date-picker';
import AddMembersDropdown from '@/components/add-members-dropdown-v2/add-members-dropdown';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAuthService } from '@/hooks/useAuth';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ITaskCreateRequest } from '@/types/tasks/task-create-request.types';

type BoardViewCreateTaskCardProps = {
  position: 'top' | 'bottom';
  sectionId: string;
  setShowNewCard: (x: boolean) => void;
};

const BoardViewCreateTaskCard = ({
  position,
  sectionId,
  setShowNewCard,
}: BoardViewCreateTaskCardProps) => {
  const { t } = useTranslation('kanban-board');
  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const currentSession = useAuthService().getCurrentSession();

  const [newTaskName, setNewTaskName] = useState<string>('');
  const [dueDate, setDueDate] = useState<Dayjs | null>(null);
  const [creatingTask, setCreatingTask] = useState<boolean>(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<InputRef>(null);

  const focusInput = () => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  // Focus when component mounts or when showNewCard becomes true
  useEffect(() => {
    focusInput();
  }, []);

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const projectId = useAppSelector(state => state.projectReducer.projectId);

  const createRequestBody = (): ITaskCreateRequest | null => {
    if (!projectId || !currentSession) return null;

    const body: ITaskCreateRequest = {
      project_id: projectId,
      name: newTaskName.trim(),
      reporter_id: currentSession.id,
      team_id: currentSession.team_id,
    };

    // Set end date if provided
    if (dueDate) {
      body.end_date = dueDate.toISOString();
    }

    // Set the appropriate group ID based on the current grouping
    const groupBy = getCurrentGroupBoard();
    if (groupBy.value === GROUP_BY_STATUS_VALUE) {
      body.status_id = sectionId;
    } else if (groupBy.value === GROUP_BY_PRIORITY_VALUE) {
      body.priority_id = sectionId;
    } else if (groupBy.value === GROUP_BY_PHASE_VALUE) {
      body.phase_id = sectionId;
    }

    return body;
  };

  const resetForm = () => {
    setNewTaskName('');
    setDueDate(null);
    setCreatingTask(false);
    setShowNewCard(true);
    focusInput();
  };

  const handleAddTaskToTheTop = async () => {
    if (creatingTask || !projectId || !currentSession || newTaskName.trim() === '') return;

    try {
      setCreatingTask(true);
      const body = createRequestBody();
      if (!body) return;

      // Create a unique event handler for this specific task creation
      const eventHandler = (task: IProjectTask) => {
        // Set creating task to false
        setCreatingTask(false);

        // Add the task to the state at the top of the section
        dispatch(
          addTaskCardToTheTop({
            sectionId: sectionId,
            task: {
              ...task,
              id: task.id || nanoid(),
              name: task.name || newTaskName.trim(),
              end_date: task.end_date || dueDate,
            },
          })
        );

        // Remove the event listener to prevent memory leaks
        socket?.off(SocketEvents.QUICK_TASK.toString(), eventHandler);

        // Reset the form
        resetForm();
      };

      // Register the event handler before emitting
      socket?.once(SocketEvents.QUICK_TASK.toString(), eventHandler);

      // Emit the event
      socket?.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));
    } catch (error) {
      console.error('Error adding task:', error);
      setCreatingTask(false);
    }
  };

  const handleAddTaskToTheBottom = async () => {
    if (creatingTask || !projectId || !currentSession || newTaskName.trim() === '') return;

    try {
      setCreatingTask(true);
      const body = createRequestBody();
      if (!body) return;

      // Create a unique event handler for this specific task creation
      const eventHandler = (task: IProjectTask) => {
        // Set creating task to false
        setCreatingTask(false);

        // Add the task to the state at the bottom of the section
        dispatch(
          addTaskCardToTheBottom({
            sectionId: sectionId,
            task: {
              ...task,
              id: task.id || nanoid(),
              name: task.name || newTaskName.trim(),
              end_date: task.end_date || dueDate,
            },
          })
        );

        // Remove the event listener to prevent memory leaks
        socket?.off(SocketEvents.QUICK_TASK.toString(), eventHandler);

        // Reset the form
        resetForm();
      };

      // Register the event handler before emitting
      socket?.once(SocketEvents.QUICK_TASK.toString(), eventHandler);

      // Emit the event
      socket?.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));
    } catch (error) {
      console.error('Error adding task:', error);
      setCreatingTask(false);
    }
  };

  const handleCancelNewCard = (e: React.FocusEvent<HTMLDivElement>) => {
    if (cardRef.current && !cardRef.current.contains(e.relatedTarget)) {
      // Only reset the form without creating a task
      setNewTaskName('');
      setShowNewCard(false);
      setDueDate(null);
      setCreatingTask(false);
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
        value={newTaskName}
        onChange={e => setNewTaskName(e.target.value)}
        onPressEnter={position === 'bottom' ? handleAddTaskToTheBottom : handleAddTaskToTheTop}
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
          <Button size="small" onClick={() => setShowNewCard(false)}>
            {t('cancel')}
          </Button>
          <Button
            type="primary"
            size="small"
            onClick={position === 'bottom' ? handleAddTaskToTheBottom : handleAddTaskToTheTop}
            loading={creatingTask}
          >
            {t('addTask')}
          </Button>
        </Flex>
      )}
    </Flex>
  );
};

export default BoardViewCreateTaskCard;
