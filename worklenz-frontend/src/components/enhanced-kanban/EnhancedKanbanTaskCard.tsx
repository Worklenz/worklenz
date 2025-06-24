import React, { useCallback, useMemo, useState } from 'react';
import { useSortable, defaultAnimateLayoutChanges } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import './EnhancedKanbanTaskCard.css';
import Flex from 'antd/es/flex';
import Tag from 'antd/es/tag';
import Tooltip from 'antd/es/tooltip';
import Progress from 'antd/es/progress';
import Button from 'antd/es/button';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setShowTaskDrawer, setSelectedTaskId } from '@/features/task-drawer/task-drawer.slice';
import PrioritySection from '../board/taskCard/priority-section/priority-section';
import Typography from 'antd/es/typography';
import CustomAvatarGroup from '../board/custom-avatar-group';
import CustomDueDatePicker from '../board/custom-due-date-picker';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { ForkOutlined } from '@ant-design/icons';
import { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { CaretDownFilled, CaretRightFilled } from '@ant-design/icons';

interface EnhancedKanbanTaskCardProps {
  task: IProjectTask;
  isActive?: boolean;
  isDragOverlay?: boolean;
  isDropTarget?: boolean;
}

const EnhancedKanbanTaskCard: React.FC<EnhancedKanbanTaskCardProps> = React.memo(({
  task,
  isActive = false,
  isDragOverlay = false,
  isDropTarget = false
}) => {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [dueDate, setDueDate] = useState<Dayjs | null>(
    task?.end_date ? dayjs(task?.end_date) : null
  );
  const [isSubTaskShow, setIsSubTaskShow] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
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

  const handleCardClick = useCallback((e: React.MouseEvent, id: string) => {
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
  }, [dispatch, isDragging]);

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
          <Flex>
            {renderLabels}
          </Flex>

          <Tooltip title={` ${task?.completed_count} / ${task?.total_tasks_count}`}>
            <Progress type="circle" percent={task?.complete_ratio} size={24} strokeWidth={(task.complete_ratio || 0) >= 100 ? 9 : 7} />
          </Tooltip>
        </Flex>
        <Flex gap={4} align="center">
          {/* Action Icons */}
          <PrioritySection task={task} />
          <Typography.Text
            style={{ fontWeight: 500 }}
            ellipsis={{ tooltip: task.name }}
          >
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
            {task && <CustomAvatarGroup task={task} sectionId={task.status_id || ''} />}

            <Flex gap={4} align="center">
              <CustomDueDatePicker task={task} onDateChange={setDueDate} />

              {/* Subtask Section */}
              <Button
                // onClick={handleSubtaskButtonClick}
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
      </div>
    </div>
  );
});

export default EnhancedKanbanTaskCard; 