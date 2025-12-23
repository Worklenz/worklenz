import React, { useCallback, useMemo, useState } from 'react';
import {
  ForkOutlined,
  CaretDownFilled,
  CaretRightFilled,
  Tag,
  Flex,
  Tooltip,
  Progress,
  Typography,
  Button,
  Divider,
  List,
  Skeleton,
  PlusOutlined,
  Dayjs,
  dayjs,
} from '@/shared/antd-imports';
import { useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setShowTaskDrawer, setSelectedTaskId } from '@/features/task-drawer/task-drawer.slice';
import {
  fetchBoardSubTasks,
  toggleTaskExpansion,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { themeWiseColor } from '@/utils/themeWiseColor';
import './EnhancedKanbanTaskCard.css';
import LazyAssigneeSelectorWrapper from '../task-management/lazy-assignee-selector';
import CustomDueDatePicker from '../board/custom-due-date-picker';
import BoardSubTaskCard from '@/pages/projects/projectView/board/board-section/board-sub-task-card/board-sub-task-card';
import EnhancedKanbanCreateSubtaskCard from './EnhancedKanbanCreateSubtaskCard';
import AvatarGroup from '@/components/AvatarGroup';

interface EnhancedKanbanTaskCardProps {
  task: IProjectTask;
  sectionId: string;
  isActive?: boolean;
  isDragOverlay?: boolean;
  isDropTarget?: boolean;
}
// Priority and status colors - moved outside component to avoid recreation
const PRIORITY_COLORS = {
  critical: '#ff4d4f',
  high: '#ff7a45',
  medium: '#faad14',
  low: '#52c41a',
} as const;

const EnhancedKanbanTaskCard: React.FC<EnhancedKanbanTaskCardProps> = React.memo(
  ({ task, sectionId, isActive = false, isDragOverlay = false, isDropTarget = false }) => {
    const dispatch = useAppDispatch();
    const { t } = useTranslation('kanban-board');
    const themeMode = useAppSelector(state => state.themeReducer.mode);
    const [showNewSubtaskCard, setShowNewSubtaskCard] = useState(false);
    const [dueDate, setDueDate] = useState<Dayjs | null>(
      task?.end_date ? dayjs(task?.end_date, 'YYYY-MM-DD') : null
    );

    const projectId = useAppSelector(state => state.projectReducer.projectId);

    // Get active filters from Redux (enhancedKanbanReducer)
    const activeFilters = useAppSelector(state => ({
      members: state.enhancedKanbanReducer?.taskAssignees?.filter((m: any) => m.selected).map((m: any) => m.id) || [],
      labels: state.enhancedKanbanReducer?.labels?.filter((l: any) => l.selected).map((l: any) => l.id) || [],
      priorities: state.enhancedKanbanReducer?.priorities || []
    }));

    // Get all priorities to create ID-to-name mapping
    const allPriorities = useAppSelector(state => state.priorityReducer?.priorities || []);
    
    // Create priority ID to name mapping
    const priorityIdToName = React.useMemo(() => {
      const map: Record<string, string> = {};
      allPriorities.forEach((p: any) => {
        // Map priority value (0=low, 1=medium, 2=high) to name
        if (p.value === 0) map[p.id] = 'low';
        if (p.value === 1) map[p.id] = 'medium';
        if (p.value === 2) map[p.id] = 'high';
      });
      return map;
    }, [allPriorities]);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: task.id!,
      data: {
        type: 'task',
        task,
      },
      disabled: isDragOverlay,
      animateLayoutChanges: defaultAnimateLayoutChanges,
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
      backgroundColor: themeMode === 'dark' ? '#292929' : '#fafafa',
    };

    const handleCardClick = useCallback(
      (e: React.MouseEvent, id: string) => {
        // Prevent the event from propagating to parent elements
        e.stopPropagation();

        // Don't handle click if we're dragging
        if (isDragging) return;
        dispatch(setSelectedTaskId(id));
        dispatch(setShowTaskDrawer(true));
      },
      [dispatch, isDragging]
    );

    const renderLabels = useMemo(() => {
      if (!task?.labels?.length) return null;

      return (
        <>
          {task.labels.slice(0, 2).map((label: any) => (
            <Tag key={label.id} style={{ marginRight: '2px' }} color={label?.color_code}>
              <span style={{ color: themeMode === 'dark' ? '#383838' : '', fontSize: 10 }}>
                {label.name}
              </span>
            </Tag>
          ))}
          {task.labels.length > 2 && <Tag>+ {task.labels.length - 2}</Tag>}
        </>
      );
    }, [task.labels, themeMode]);

    const handleSubTaskExpand = useCallback(() => {
      if (task && task.id && projectId) {
        const subtaskCount = task.sub_tasks_count ?? 0;
        // Check if subtasks are already loaded and we have subtask data
        if (task.sub_tasks && task.sub_tasks.length > 0 && subtaskCount > 0) {
          // If subtasks are already loaded, just toggle visibility
          dispatch(toggleTaskExpansion(task.id));
        } else if (subtaskCount > 0) {
          // If we have a subtask count but no loaded subtasks, fetch them
          dispatch(toggleTaskExpansion(task.id));
          dispatch(fetchBoardSubTasks({ taskId: task.id, projectId }));
        } else {
          // If no subtasks exist, just toggle visibility (will show empty state)
          dispatch(toggleTaskExpansion(task.id));
        }
      }
    }, [task, projectId, dispatch]);

    const handleSubtaskButtonClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        handleSubTaskExpand();
      },
      [handleSubTaskExpand]
    );

    const handleAddSubtaskClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      setShowNewSubtaskCard(true);
    }, []);

    // Filter subtasks based on active filters
    const filteredSubtasks = React.useMemo(() => {
      if (!task.sub_tasks || task.sub_tasks.length === 0) return [];

      // If no filters are active, show all subtasks
      const hasActiveFilters = 
        activeFilters.members.length > 0 || 
        activeFilters.labels.length > 0 || 
        activeFilters.priorities.length > 0;

      if (!hasActiveFilters) {
        return task.sub_tasks;
      }

      // Filter subtasks based on active filters
      return task.sub_tasks.filter((subtask: any) => {
        // Check member filter
        if (activeFilters.members.length > 0) {
          const hasMatchingMember = subtask.assignees?.some((a: any) => {
            const assigneeId = typeof a === 'string' ? a : (a.team_member_id || a.id);
            return activeFilters.members.includes(assigneeId);
          });
          if (!hasMatchingMember) return false;
        }

        // Check label filter
        if (activeFilters.labels.length > 0) {
          const hasMatchingLabel = subtask.labels?.some((l: any) => 
            activeFilters.labels.includes(l.id)
          );
          if (!hasMatchingLabel) return false;
        }

        // Check priority filter
        if (activeFilters.priorities.length > 0) {
          const filterPriorityNames = activeFilters.priorities
            .map(id => priorityIdToName[id])
            .filter(Boolean);
          
          if (!filterPriorityNames.includes(subtask.priority)) {
            return false;
          }
        }

        return true;
      });
    }, [task.sub_tasks, activeFilters, priorityIdToName]);

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`enhanced-kanban-task-card ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''} ${isDragOverlay ? 'drag-overlay' : ''} ${isDropTarget ? 'drop-target' : ''}`}
        {...attributes}
        {...listeners}
      >
        <div className="task-content" onClick={e => handleCardClick(e, task.id || '')}>
          <Flex align="center" justify="space-between" className="mb-2">
            <Flex>{renderLabels}</Flex>

            <Tooltip title={` ${task?.completed_count} / ${task?.total_tasks_count}`}>
              <Progress
                type="circle"
                percent={task?.complete_ratio}
                size={24}
                strokeWidth={(task.complete_ratio || 0) >= 100 ? 9 : 7}
              />
            </Tooltip>
          </Flex>
          <Flex gap={4} align="center">
            {/* Action Icons */}
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: task.priority_color || '#d9d9d9' }}
            />
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
            <Flex align="center" gap={2}>
              <AvatarGroup
                members={task.names || []}
                maxCount={3}
                isDarkMode={themeMode === 'dark'}
                size={24}
              />
              <LazyAssigneeSelectorWrapper
                task={task}
                groupId={sectionId}
                isDarkMode={themeMode === 'dark'}
                kanbanMode={true}
              />
            </Flex>
            <Flex gap={4} align="center">
              <CustomDueDatePicker task={task} onDateChange={setDueDate} />

              {/* Subtask Section - only show if count > 1 */}
              {task.sub_tasks_count != null && Number(task.sub_tasks_count) > 1 && (
                <Tooltip
                  title={t(
                    `indicators.tooltips.subtasks${Number(task.sub_tasks_count) === 1 ? '' : '_plural'}`,
                    { count: Number(task.sub_tasks_count) }
                  )}
                >
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
                      <span>{task.sub_tasks_count || 0}</span>
                      {task.show_sub_tasks ? <CaretDownFilled /> : <CaretRightFilled />}
                    </Tag>
                  </Button>
                </Tooltip>
              )}
            </Flex>
          </Flex>
          <Flex vertical gap={8}>
            {task.show_sub_tasks && (
              <Flex vertical>
                <Divider style={{ marginBlock: 0 }} />
                <List>
                  {task.sub_tasks_loading && (
                    <List.Item>
                      <Skeleton
                        active
                        paragraph={{ rows: 2 }}
                        title={false}
                        style={{ marginTop: 8 }}
                      />
                    </List.Item>
                  )}

                  {!task.sub_tasks_loading &&
                    filteredSubtasks.length > 0 &&
                    filteredSubtasks.map((subtask: any) => (
                      <BoardSubTaskCard key={subtask.id} subtask={subtask} sectionId={sectionId} />
                    ))}

                  {!task.sub_tasks_loading &&
                    filteredSubtasks.length === 0 &&
                    task.sub_tasks_count === 0 && (
                      <List.Item>
                        <div style={{ padding: '8px 0', color: '#999', fontSize: '12px' }}>
                          {t('noSubtasks', 'No subtasks')}
                        </div>
                      </List.Item>
                    )}

                  {showNewSubtaskCard && (
                    <EnhancedKanbanCreateSubtaskCard
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
        </div>
      </div>
    );
  }
);

export default EnhancedKanbanTaskCard;
