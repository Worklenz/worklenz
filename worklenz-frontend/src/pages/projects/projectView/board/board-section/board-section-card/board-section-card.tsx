import { Button, Flex } from '@/shared/antd-imports';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useAppSelector } from '@/hooks/useAppSelector';
import { themeWiseColor } from '@/utils/themeWiseColor';
import BoardSectionCardHeader from './board-section-card-header';
import { PlusOutlined } from '@/shared/antd-imports';
import BoardViewTaskCard from '../board-task-card/board-view-task-card';
import BoardViewCreateTaskCard from '../board-task-card/board-view-create-task-card';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { DEFAULT_TASK_NAME } from '@/shared/constants';
import { ITaskCreateRequest } from '@/types/tasks/task-create-request.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import logger from '@/utils/errorLogger';

interface IBoardSectionCardProps {
  taskGroup: ITaskListGroup;
}

const BoardSectionCard = ({ taskGroup }: IBoardSectionCardProps) => {
  const { t } = useTranslation('kanban-board');
  const scrollContainerRef = useRef<any>(null);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { projectId } = useAppSelector(state => state.projectReducer);
  const { team_id: teamId, id: reporterId } = useAppSelector(state => state.userReducer);
  const { socket } = useSocket();

  const [name, setName] = useState<string>(taskGroup.name);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isHover, setIsHover] = useState<boolean>(false);
  const [showNewCardTop, setShowNewCardTop] = useState<boolean>(false);
  const [showNewCardBottom, setShowNewCardBottom] = useState<boolean>(false);
  const [creatingTempTask, setCreatingTempTask] = useState<boolean>(false);

  const { setNodeRef: setDroppableRef } = useDroppable({
    id: taskGroup.id,
    data: {
      type: 'section',
      section: taskGroup,
    },
  });

  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: taskGroup.id,
    data: {
      type: 'section',
      section: taskGroup,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const setRefs = (el: HTMLElement | null) => {
    setSortableRef(el);
    setDroppableRef(el);
  };

  const getInstantTask = async ({
    task_id,
    group_id,
    task,
  }: {
    task_id: string;
    group_id: string;
    task: IProjectTask;
  }) => {
    try {
    } catch (error) {
      logger.error('Error creating instant task', error);
    }
  };

  const createTempTask = async () => {
    if (creatingTempTask || !projectId) return;
    setCreatingTempTask(true);

    const body: ITaskCreateRequest = {
      name: DEFAULT_TASK_NAME,
      project_id: projectId,
      team_id: teamId,
      reporter_id: reporterId,
      status_id: taskGroup.id,
    };

    socket?.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));
  };

  const handleAddTaskToBottom = () => {
    // createTempTask();
    setShowNewCardBottom(true);
  };

  useEffect(() => {
    if (showNewCardBottom && scrollContainerRef.current) {
      const timeout = setTimeout(() => {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }, 300);

      return () => clearTimeout(timeout);
    }
  }, [taskGroup.tasks, showNewCardBottom]);

  return (
    <Flex
      vertical
      gap={16}
      ref={setRefs}
      {...attributes}
      {...listeners}
      style={{
        ...style,
        minWidth: 375,
        outline: isHover
          ? `1px solid ${themeWiseColor('#edeae9', '#ffffff12', themeMode)}`
          : 'none',
        padding: 8,
        borderRadius: 12,
      }}
      className="h-[600px] max-h-[600px] overflow-y-scroll board-section"
      data-section-id={taskGroup.id}
      data-droppable="true"
      data-over="false"
    >
      <BoardSectionCardHeader
        groupId={taskGroup.id}
        key={taskGroup.id}
        categoryId={taskGroup.category_id ?? null}
        name={name}
        tasksCount={taskGroup?.tasks.length}
        isLoading={isLoading}
        setName={setName}
        colorCode={themeWiseColor(taskGroup?.color_code, taskGroup?.color_code_dark, themeMode)}
        onHoverChange={setIsHover}
        setShowNewCard={setShowNewCardTop}
      />

      <Flex
        vertical
        gap={16}
        ref={scrollContainerRef}
        style={{
          borderRadius: 6,
          height: taskGroup?.tasks.length <= 0 ? 600 : 'auto',
          maxHeight: taskGroup?.tasks.length <= 0 ? 600 : 'auto',
          overflowY: 'scroll',
          padding: taskGroup?.tasks.length <= 0 ? 8 : 6,
          background:
            taskGroup?.tasks.length <= 0 && !showNewCardTop && !showNewCardBottom
              ? themeWiseColor(
                  'linear-gradient( 180deg, #fafafa, rgba(245, 243, 243, 0))',
                  'linear-gradient( 180deg, #2a2b2d, rgba(42, 43, 45, 0))',
                  themeMode
                )
              : 'transparent',
        }}
      >
        <SortableContext
          items={taskGroup.tasks.map(task => task.id ?? '')}
          strategy={verticalListSortingStrategy}
        >
          <Flex vertical gap={16} align="center">
            {showNewCardTop && (
              <BoardViewCreateTaskCard
                position="top"
                sectionId={taskGroup.id}
                setShowNewCard={setShowNewCardTop}
              />
            )}

            {taskGroup.tasks.map((task: any) => (
              <BoardViewTaskCard key={task.id} sectionId={taskGroup.id} task={task} />
            ))}

            {showNewCardBottom && (
              <BoardViewCreateTaskCard
                position="bottom"
                sectionId={taskGroup.id}
                setShowNewCard={setShowNewCardBottom}
              />
            )}
          </Flex>
        </SortableContext>

        <Button
          type="text"
          style={{
            height: '38px',
            width: '100%',
            borderRadius: 6,
            boxShadow: 'none',
          }}
          icon={<PlusOutlined />}
          onClick={handleAddTaskToBottom}
        >
          {t('addTask')}
        </Button>
      </Flex>
    </Flex>
  );
};

export default BoardSectionCard;
