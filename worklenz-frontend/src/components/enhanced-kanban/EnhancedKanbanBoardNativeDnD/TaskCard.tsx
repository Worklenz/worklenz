import React, { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import { useTranslation } from 'react-i18next';
import AvatarGroup from '@/components/AvatarGroup';
import LazyAssigneeSelectorWrapper from '@/components/task-management/lazy-assignee-selector';
import { format } from 'date-fns';

interface TaskCardProps {
    task: IProjectTask;
    onTaskDragStart: (e: React.DragEvent, taskId: string, groupId: string) => void;
    onTaskDragOver: (e: React.DragEvent, groupId: string, taskIdx: number) => void;
    onTaskDrop: (e: React.DragEvent, groupId: string, taskIdx: number) => void;
    groupId: string;
    isDropIndicator: boolean;
    idx: number;
}

const TaskCard: React.FC<TaskCardProps> = memo(({
    task,
    onTaskDragStart,
    onTaskDragOver,
    onTaskDrop,
    groupId,
    isDropIndicator,
    idx
}) => {
    const themeMode = useSelector((state: RootState) => state.themeReducer.mode);
    const background = themeMode === 'dark' ? '#23272f' : '#fff';
    const color = themeMode === 'dark' ? '#fff' : '#23272f';
    const dispatch = useAppDispatch();
    const { t } = useTranslation('kanban-board');

    const handleCardClick = useCallback((e: React.MouseEvent, id: string) => {
        // Prevent the event from propagating to parent elements
        e.stopPropagation();
        dispatch(setSelectedTaskId(id));
        dispatch(setShowTaskDrawer(true));
    }, [dispatch]);

    return (
        <>
            {isDropIndicator && (
                <div
                    style={{
                        height: 80,
                        background: themeMode === 'dark' ? '#2a2a2a' : '#f0f0f0',
                        borderRadius: 6,
                        border: `5px`
                    }}
                    onDragStart={e => onTaskDragStart(e, task.id!, groupId)}
                    onDragOver={e => onTaskDragOver(e, groupId, idx)}
                    onDrop={e => onTaskDrop(e, groupId, idx)}
                />
            )}
            <div
                className="enhanced-kanban-task-card"
                draggable
                onDragStart={e => onTaskDragStart(e, task.id!, groupId)}
                onDragOver={e => onTaskDragOver(e, groupId, idx)}
                onDrop={e => onTaskDrop(e, groupId, idx)}
                style={{ background, color }}
                onClick={e => handleCardClick(e, task.id!)}
            >
                <div className="task-content">
                    <div className="task_labels" style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                        {task.labels?.map(label => (
                            <div
                                key={label.id}
                                className="task-label"
                                style={{
                                    backgroundColor: label.color_code,
                                    display: 'inline-block',
                                    borderRadius: '4px',
                                    padding: '2px 8px',
                                    color: '#fff',
                                    fontSize: 8,
                                    marginRight: 4,
                                    whiteSpace: 'nowrap',
                                    minWidth: 0
                                }}
                            >
                                {label.name}
                            </div>
                        ))}
                    </div>
                    <div className="task-content" style={{ display: 'flex', alignItems: 'center' }}>
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: task.priority_color || '#d9d9d9' }}
                        />
                        <div className="task-title" style={{ marginLeft: 8 }}>{task.name}</div>
                    </div>

                    <div className="task-assignees-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <div className="task-assignees" style={{ display: 'flex', alignItems: 'center' }}>
                            <AvatarGroup
                                members={task.names || []}
                                maxCount={3}
                                isDarkMode={themeMode === 'dark'}
                                size={24}
                            />
                            <LazyAssigneeSelectorWrapper task={task} groupId={groupId} isDarkMode={themeMode === 'dark'} />
                        </div>
                        <div className="task-due-date" style={{ fontSize: 10, color: '#888', marginLeft: 8, whiteSpace: 'nowrap' }}>
                            {task.end_date ? format(new Date(task.end_date), 'MMM d, yyyy') : ''}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
});

TaskCard.displayName = 'TaskCard';

export default TaskCard; 