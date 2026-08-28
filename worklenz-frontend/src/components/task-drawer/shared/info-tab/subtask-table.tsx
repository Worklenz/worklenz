import {
  Button,
  Flex,
  Input,
  Popconfirm,
  Progress,
  Tag,
  Tooltip,
} from '@/shared/antd-imports';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleFilled,
  HolderOutlined,
  PlusOutlined,
} from '@/shared/antd-imports';
import { nanoid } from '@reduxjs/toolkit';
import { TFunction } from 'i18next';

import {
  DndContext,
  closestCenter,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { colors } from '@/styles/colors';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { ISubTask } from '@/types/tasks/subTask.types';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import Avatars from '@/components/avatars/avatars';
import './subtask-table.css';
import { getUserSession } from '@/utils/session-helper';
import { SocketEvents } from '@/shared/socket-events';
import { useSocket } from '@/socket/socketContext';
import {
  getCurrentGroup,
  GROUP_BY_STATUS_VALUE,
  GROUP_BY_PRIORITY_VALUE,
  GROUP_BY_PHASE_VALUE,
  removeSubTask,
} from '@/features/tasks/tasks.slice';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import logger from '@/utils/errorLogger';
import {
  setShowTaskDrawer,
  setSelectedTaskId,
  fetchTask,
} from '@/features/task-drawer/task-drawer.slice';
import { updateSubtask } from '@/features/board/board-slice';
import { updateEnhancedKanbanSubtask } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import {
  deleteTask,
  reorderSubtasks,
} from '@/features/task-management/task-management.slice';

type SubTaskTableProps = {
  subTasks: ISubTask[];
  loadingSubTasks: boolean;
  refreshSubTasks: () => void;
  canCreateTask?: boolean;
  isGuest?: boolean;
  t: TFunction;
};

type SubtaskCreatePayload = {
  project_id: string;
  name: string;
  reporter_id?: string;
  team_id?: string;
  status_id?: string;
  priority_id?: string;
  phase_id?: string;
  parent_task_id?: string;
};

// ─── Sortable subtask row ────────────────────────────────────────────────────

interface SortableRowProps {
  subtask: ISubTask;
  themeMode: string;
  onEdit: (id: string) => void;
  onDelete: (id?: string) => void;
  t: TFunction;
  isGuest?: boolean;
}

const SortableSubtaskRow = ({ subtask, themeMode, onEdit, onDelete, t, isGuest = false }: SortableRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subtask.id ?? nanoid(),
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    display: 'grid',
    gridTemplateColumns: '32px 1fr 85px 100px 48px 72px',
    alignItems: 'center',
    gap: 8,
    padding: '4px 8px',
    borderRadius: 4,
    minHeight: 36,
    cursor: 'pointer',
    background: isDragging
      ? themeMode === 'dark'
        ? '#2a2a2a'
        : '#f0f0f0'
      : 'transparent',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="subtask-row group"
      onClick={() => !isGuest && subtask.id && onEdit(subtask.id)}
    >
      {/* Drag handle */}
      <span
        {...(isGuest ? {} : { ...attributes, ...listeners })}
        className="subtask-drag-handle text-gray-400 hover:text-gray-600"
        onClick={e => e.stopPropagation()}
        style={{
          cursor: isGuest ? 'default' : 'grab',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          opacity: isGuest ? 0.5 : 1,
        }}
      >
        <HolderOutlined />
      </span>

      {/* Name */}
      <span
        style={{
          fontSize: 13,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}
      >
        {subtask.name}
      </span>

      {/* Priority column — fixed width so all rows align, tag left-aligned */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', minWidth: 0 }}>
        <Tooltip 
          title={subtask.priority_name}
          placement="top"
        >
          <Tag
            color={(themeMode === 'dark' ? subtask.priority_color_dark : subtask.priority_color)?.slice(0, 7)}
            style={{ 
              textTransform: 'capitalize', 
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {subtask.priority_name}
          </Tag>
        </Tooltip>
      </div>

      {/* Status column — fixed width, tag left-aligned */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', minWidth: 0 }}>
        <Tooltip 
          title={subtask.status_name}
          placement="top"
        >
          <Tag
            color={(themeMode === 'dark' ? subtask.status_color_dark : subtask.status_color)?.slice(0, 7)}
            style={{ 
              textTransform: 'capitalize', 
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {subtask.status_name}
          </Tag>
        </Tooltip>
      </div>

      {/* Assignees */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          minWidth: 0,
          width: 48,
          maxWidth: 48,
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <Avatars members={subtask.names || []} maxCount={2} />
      </div>

      {/* Action buttons */}
      {!isGuest && (
        <Flex gap={4} align="center" justify="flex-end" className="action-buttons" onClick={e => e.stopPropagation()}>
          <Tooltip title={typeof t === 'function' ? t('taskInfoTab.subTasks.edit') : 'Edit'}>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={e => {
                e.stopPropagation();
                subtask.id && onEdit(subtask.id);
              }}
            />
          </Tooltip>
          <Popconfirm
            title={t('taskInfoTab.subTasks.confirmDeleteSubTask', { defaultValue: 'Are you sure you want to delete this subtask?' })}
            icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
            okText={t('taskInfoTab.subTasks.confirmDeleteYes', { defaultValue: 'Yes' })}
            cancelText={t('taskInfoTab.subTasks.confirmDeleteNo', { defaultValue: 'No' })}
            onPopupClick={e => e.stopPropagation()}
            onConfirm={e => {
              e?.stopPropagation();
              onDelete(subtask.id);
            }}
          >
            <Tooltip title={t('taskInfoTab.subTasks.delete', { defaultValue: 'Delete' })}>
              <Button
                shape="default"
                icon={<DeleteOutlined />}
                size="small"
                onClick={e => e.stopPropagation()}
              />
            </Tooltip>
          </Popconfirm>
        </Flex>
      )}
    </div>
  );
};

// ─── Main component ──────────────────────────────────────────────────────────

const SubTaskTable = ({
  subTasks,
  loadingSubTasks,
  refreshSubTasks,
  canCreateTask = true,
  isGuest = false,
  t,
}: SubTaskTableProps) => {
  const { socket, connected } = useSocket();
  const [isEdit, setIsEdit] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [localSubTasks, setLocalSubTasks] = useState<ISubTask[]>(subTasks);
  const [activeSubtask, setActiveSubtask] = useState<ISubTask | null>(null);

  // Ref-based flag: true while we are waiting for the ack to our own drag emit.
  // Using a ref avoids stale closures in the socket listener without causing
  // extra re-renders. Auto-clears after 3s as a safety net in case the ack
  // never arrives (e.g. socket disconnect mid-drag).
  const drawerDragPendingRef = useRef(false);
  const drawerDragPendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { projectId } = useAppSelector(state => state.projectReducer);
  const { taskFormViewModel, selectedTaskId } = useAppSelector(
    state => state.taskDrawerReducer
  );
  const currentSession = getUserSession();
  const { projectView } = useTabSearchParam();
  const dispatch = useAppDispatch();

  // ── Keep drawer in sync when the parent component re-fetches (REST) ───────
  useEffect(() => {
    setLocalSubTasks(subTasks);
  }, [subTasks]);

  // Clean up the pending timer on unmount
  useEffect(() => {
    return () => {
      if (drawerDragPendingTimerRef.current) {
        clearTimeout(drawerDragPendingTimerRef.current);
      }
    };
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const sortableIds = useMemo(
    () => localSubTasks.map(s => s.id ?? nanoid()),
    [localSubTasks]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (isGuest) return;
      const found = localSubTasks.find(s => s.id === event.active.id);
      setActiveSubtask(found ?? null);
    },
    [localSubTasks, isGuest]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveSubtask(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = localSubTasks.findIndex(s => s.id === active.id);
      const newIndex = localSubTasks.findIndex(s => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(localSubTasks, oldIndex, newIndex);

      // 1. Optimistic update: drawer local state
      setLocalSubTasks(reordered);

      // 2. Optimistic update: Redux (keeps task list in sync immediately without
      //    waiting for the socket ack or a REST re-fetch)
      if (selectedTaskId) {
        dispatch(
          reorderSubtasks({
            parentTaskId: selectedTaskId,
            orderedSubtasks: reordered.map((s, i) => ({
              id: s.id as string,
              name: s.name ?? '',
              title: s.name ?? '',
              status: s.status_id ?? '',
              priority: s.priority ?? '',
              order: i,
              sort_order: i,
              created_at: s.created_at ?? '',
              updated_at: s.updated_at ?? '',
            })),
          })
        );
      }

      // 3. Persist to the backend via socket
      const subtaskUpdates = reordered.map((subtask, index) => ({
        task_id: subtask.id as string,
        sort_order: index,
      }));

      if (socket && connected && selectedTaskId) {
        // Flag so the incoming ack doesn't trigger an unnecessary re-fetch.
        // Auto-clear after 3s as a safety net in case the ack never arrives.
        drawerDragPendingRef.current = true;
        if (drawerDragPendingTimerRef.current) {
          clearTimeout(drawerDragPendingTimerRef.current);
        }
        drawerDragPendingTimerRef.current = setTimeout(() => {
          drawerDragPendingRef.current = false;
          drawerDragPendingTimerRef.current = null;
        }, 3000);

        socket.emit(SocketEvents.SUBTASK_SORT_ORDER_CHANGE.toString(), {
          parent_task_id: selectedTaskId,
          subtask_updates: subtaskUpdates,
        });
      }
    },
    [localSubTasks, socket, connected, selectedTaskId, dispatch]
  );

  const createRequestBody = (taskName: string): SubtaskCreatePayload | null => {
    if (!projectId || !currentSession) return null;

    const body: SubtaskCreatePayload = {
      project_id: projectId,
      name: taskName,
      reporter_id: currentSession.id,
      team_id: currentSession.team_id,
    };

    const groupBy = getCurrentGroup();
    const task = taskFormViewModel?.task;

    if (groupBy.value === GROUP_BY_STATUS_VALUE) {
      body.status_id = task?.status_id;
    } else if (groupBy.value === GROUP_BY_PRIORITY_VALUE) {
      body.priority_id = task?.priority_id;
    } else if (groupBy.value === GROUP_BY_PHASE_VALUE) {
      body.phase_id = task?.phase_id;
    }

    if (selectedTaskId) {
      body.parent_task_id = selectedTaskId;
    }

    return body;
  };

  const addInstantTask = async (taskName: string) => {
    if (creatingTask || !taskName?.trim() || !connected) return;

    try {
      setCreatingTask(true);
      const body = createRequestBody(taskName);
      if (!body) return;

      socket?.emit(SocketEvents.QUICK_TASK.toString(), JSON.stringify(body));
      socket?.once(SocketEvents.QUICK_TASK.toString(), (task: IProjectTask) => {
        if (task.parent_task_id) {
          refreshSubTasks();
          dispatch(updateSubtask({ sectionId: '', subtask: task, mode: 'add' }));
        }
      });
    } catch (error) {
      console.error('Error adding subtask:', error);
    } finally {
      setCreatingTask(false);
      setNewTaskName('');
      setIsEdit(true);
    }
  };

  const handleDeleteSubTask = async (taskId?: string) => {
    if (!taskId) return;

    try {
      await tasksApiService.deleteTask(taskId);

      if (selectedTaskId) {
        dispatch(removeSubTask({ subtaskId: taskId, parentTaskId: selectedTaskId }));
      }

      dispatch(deleteTask({ taskId, parentTaskId: selectedTaskId || undefined }));

      dispatch(
        updateEnhancedKanbanSubtask({
          sectionId: '',
          subtask: {
            id: taskId,
            parent_task_id: selectedTaskId || '',
            manual_progress: false,
          },
          mode: 'delete',
        })
      );

      dispatch(
        updateSubtask({
          sectionId: '',
          subtask: {
            id: taskId,
            parent_task_id: selectedTaskId || '',
            manual_progress: false,
          },
          mode: 'delete',
        })
      );

      refreshSubTasks();
    } catch (error) {
      logger.error('Error deleting subtask:', error);
    }
  };

  const handleOnBlur = () => {
    if (newTaskName.trim() === '') {
      setIsEdit(true);
      return;
    }
    addInstantTask(newTaskName);
  };

  const handleInputBlur = () => {
    if (newTaskName.trim() === '') {
      setIsEdit(false);
    } else {
      handleOnBlur();
    }
  };

  useEffect(() => {
    if (isEdit && !creatingTask && newTaskName === '') {
      const inputElement = document.querySelector('.subtask-table-input') as HTMLInputElement;
      if (inputElement) {
        inputElement.focus();
      }
    }
  }, [isEdit, creatingTask, newTaskName]);

  const handleEditSubTask = (taskId: string) => {
    if (!taskId || !projectId) return;

    dispatch(setShowTaskDrawer(false));
    setTimeout(() => {
      dispatch(setSelectedTaskId(taskId));
      dispatch(setShowTaskDrawer(true));
      dispatch(fetchTask({ taskId, projectId }));
    }, 100);
  };

  const getSubTasksProgress = () => {
    const ratio = taskFormViewModel?.task?.complete_ratio || 0;
    return ratio === Infinity ? 0 : ratio;
  };

  return (
    <Flex vertical gap={12}>
      {taskFormViewModel?.task?.sub_tasks_count !== undefined && (
        <Progress percent={getSubTasksProgress()} />
      )}

      <Flex vertical gap={6}>
        {localSubTasks.length > 0 && (
          <DndContext
            sensors={isGuest ? [] : sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <div className="subtask-list">
                {localSubTasks.map(subtask => (
                  <SortableSubtaskRow
                    key={subtask.id}
                    subtask={subtask}
                    themeMode={themeMode}
                    onEdit={handleEditSubTask}
                    onDelete={handleDeleteSubTask}
                    t={t}
                    isGuest={isGuest}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeSubtask && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 1fr 85px 100px 48px 72px',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 8px',
                    borderRadius: 4,
                    minHeight: 36,
                    background: themeMode === 'dark' ? '#2a2a2a' : '#f5f5f5',
                    border: `1px solid ${themeMode === 'dark' ? '#444' : '#d9d9d9'}`,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    opacity: 0.95,
                  }}
                >
                  <HolderOutlined style={{ color: themeMode === 'dark' ? '#888' : '#bbb', textAlign: 'center' }} />
                  <span style={{ fontSize: 13 }}>{activeSubtask.name}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        <div className="flex items-center min-w-max px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[36px]">
          {isEdit && !isGuest ? (
            <Input
              autoFocus
              value={newTaskName}
              onChange={e => setNewTaskName(e.target.value)}
              style={{ border: 'none', boxShadow: 'none', height: 38 }}
              placeholder={
                typeof t === 'function'
                  ? t('taskInfoTab.subTasks.addSubTaskInputPlaceholder')
                  : 'Type your task and hit enter'
              }
              onBlur={handleInputBlur}
              onPressEnter={handleOnBlur}
              size="small"
              className="subtask-table-input"
            />
          ) : !isGuest ? (
            <button
              type="button"
              onClick={() => setIsEdit(true)}
              className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors h-full w-full px-2 text-left"
            >
              <PlusOutlined style={{ color: themeMode === 'dark' ? '#8c8c8c' : '#595959' }} />
              {t('taskInfoTab.subTasks.addSubTask')}
            </button>
          ) : null}
        </div>
      </Flex>
    </Flex>
  );
};

export default SubTaskTable;
