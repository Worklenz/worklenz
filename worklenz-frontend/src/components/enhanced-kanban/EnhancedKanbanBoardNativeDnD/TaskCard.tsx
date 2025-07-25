import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setSelectedTaskId, setShowTaskDrawer } from '@/features/task-drawer/task-drawer.slice';
import { useTranslation } from 'react-i18next';
import AvatarGroup from '@/components/AvatarGroup';
import LazyAssigneeSelectorWrapper from '@/components/task-management/lazy-assignee-selector';
import { format } from 'date-fns';
import logger from '@/utils/errorLogger';
import { createPortal } from 'react-dom';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { getUserSession } from '@/utils/session-helper';
import { themeWiseColor } from '@/utils/themeWiseColor';
import { toggleTaskExpansion, fetchBoardSubTasks, deleteTask as deleteKanbanTask, updateEnhancedKanbanSubtask } from '@/features/enhanced-kanban/enhanced-kanban.slice';
import TaskProgressCircle from './TaskProgressCircle';
import { Button, Modal } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { tasksApiService } from '@/api/tasks/tasks.api.service';

// Simple Portal component
const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const portalRoot = document.getElementById('portal-root') || document.body;
    return createPortal(children, portalRoot);
};

interface TaskCardProps {
    task: IProjectTask;
    onTaskDragStart: (e: React.DragEvent, taskId: string, groupId: string) => void;
    onTaskDragOver: (e: React.DragEvent, groupId: string, taskIdx: number) => void;
    onTaskDrop: (e: React.DragEvent, groupId: string, taskIdx: number) => void;
    groupId: string;
    idx: number;
    onDragEnd: (e: React.DragEvent) => void; // <-- add this
}

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
    return new Date(year, month, 1).getDay();
}

const TaskCard: React.FC<TaskCardProps> = memo(({
    task,
    onTaskDragStart,
    onTaskDragOver,
    onTaskDrop,
    groupId,
    idx,
    onDragEnd // <-- add this
}) => {
    const { socket } = useSocket();
    const themeMode = useSelector((state: RootState) => state.themeReducer.mode);
    const { projectId } = useSelector((state: RootState) => state.projectReducer);
    const background = themeMode === 'dark' ? '#23272f' : '#fff';
    const color = themeMode === 'dark' ? '#fff' : '#23272f';
    const dispatch = useAppDispatch();
    const { t } = useTranslation('kanban-board');

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(
        task.end_date ? new Date(task.end_date) : null
    );
    const [isUpdating, setIsUpdating] = useState(false);
    const datePickerRef = useRef<HTMLDivElement>(null);
    const dateButtonRef = useRef<HTMLDivElement>(null);
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const d = selectedDate || new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });
    const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 });
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const [selectedTask, setSelectedTask] = useState<IProjectTask | null>(null);

    useEffect(() => {
        setSelectedDate(task.end_date ? new Date(task.end_date) : null);
    }, [task.end_date]);

    // Close date picker when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
                setShowDatePicker(false);
            }
        };

        if (showDatePicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDatePicker]);

    useEffect(() => {
        if (showDatePicker && dateButtonRef.current) {
            const rect = dateButtonRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
            });
        }
    }, [showDatePicker]);

    // Hide context menu on click elsewhere
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                setContextMenu({ ...contextMenu, visible: false });
            }
        };
        if (contextMenu.visible) {
            document.addEventListener('mousedown', handleClick);
        }
        return () => {
            document.removeEventListener('mousedown', handleClick);
        };
    }, [contextMenu]);

    const handleCardClick = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        dispatch(setSelectedTaskId(id));
        dispatch(setShowTaskDrawer(true));
    }, [dispatch]);

    const handleDateClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setShowDatePicker(true);
    }, []);

    const handleDateChange = useCallback(
        (date: Date | null) => {
            if (!task.id || !projectId) return;
            setIsUpdating(true);
            try {
                setSelectedDate(date);
                socket?.emit(
                    SocketEvents.TASK_END_DATE_CHANGE.toString(),
                    JSON.stringify({
                        task_id: task.id,
                        end_date: date,
                        parent_task: task.parent_task_id,
                        time_zone: getUserSession()?.timezone_name
                            ? getUserSession()?.timezone_name
                            : Intl.DateTimeFormat().resolvedOptions().timeZone,
                    })
                );
            } catch (error) {
                logger.error('Failed to update due date:', error);
            } finally {
                setIsUpdating(false);
                setShowDatePicker(false);
            }
        },
        [task.id, projectId, socket]
    );

    const handleClearDate = useCallback(() => {
        handleDateChange(null);
    }, [handleDateChange]);

    const handleToday = useCallback(() => {
        handleDateChange(new Date());
    }, [handleDateChange]);

    const handleTomorrow = useCallback(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        handleDateChange(tomorrow);
    }, [handleDateChange]);

    const handleNextWeek = useCallback(() => {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        handleDateChange(nextWeek);
    }, [handleDateChange]);

    const handleSubTaskExpand = useCallback(() => {
        if (task && task.id && projectId) {
            if (task.sub_tasks && task.sub_tasks.length > 0 && task.sub_tasks_count && task.sub_tasks_count > 0) {
                dispatch(toggleTaskExpansion(task.id));
            } else if (task.sub_tasks_count && task.sub_tasks_count > 0) {
                dispatch(toggleTaskExpansion(task.id));
                dispatch(fetchBoardSubTasks({ taskId: task.id, projectId }));
            } else {
                dispatch(toggleTaskExpansion(task.id));
            }
        }
    }, [task, projectId, dispatch]);

    const handleSubtaskButtonClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        handleSubTaskExpand();
    }, [handleSubTaskExpand]);

    // Delete logic (similar to task-drawer-header)
    const handleDeleteTask = async (task: IProjectTask | null) => {
        if (!task || !task.id) return;
        Modal.confirm({
            title: t('deleteTaskTitle'),
            content: t('deleteTaskContent'),
            okText: t('deleteTaskConfirm'),
            okType: 'danger',
            cancelText: t('deleteTaskCancel'),
            centered: true,
            onOk: async () => {
                if (!task.id) return;
                const res = await tasksApiService.deleteTask(task.id);
                if (res.done) {
                    dispatch(setSelectedTaskId(null));
                    if (task.is_sub_task) {
                        dispatch(updateEnhancedKanbanSubtask({
                            sectionId: '',
                            subtask: { id: task.id , parent_task_id: task.parent_task_id || '', manual_progress: false },
                            mode: 'delete',
                        }));
                    } else {
                        dispatch(deleteKanbanTask(task.id));
                    }
                    dispatch(setShowTaskDrawer(false));
                    if (task.parent_task_id) {
                        socket?.emit(
                            SocketEvents.GET_TASK_PROGRESS.toString(),
                            task.parent_task_id
                        );
                    }
                }
                setContextMenu({ visible: false, x: 0, y: 0 });
                setSelectedTask(null);
            },
            onCancel: () => {
                setContextMenu({ visible: false, x: 0, y: 0 });
                setSelectedTask(null);
            },
        });
    };

    // Calendar rendering helpers
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfWeek = (getFirstDayOfWeek(year, month) + 6) % 7; // Make Monday first
    const today = new Date();

    const weeks: (Date | null)[][] = [];
    let week: (Date | null)[] = Array(firstDayOfWeek).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
        week.push(new Date(year, month, day));
        if (week.length === 7) {
            weeks.push(week);
            week = [];
        }
    }
    if (week.length > 0) {
        while (week.length < 7) week.push(null);
        weeks.push(week);
    }
    const [isDown, setIsDown] = useState(false);

    return (
        <>
            {/* Context menu for delete */}
            {contextMenu.visible && (
                <div
                    ref={contextMenuRef}
                    style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        zIndex: 9999,
                        background: themeMode === 'dark' ? '#23272f' : '#fff',
                        borderRadius: 8,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                        padding: 0,
                        minWidth: 120,
                        transition: 'translateY(0)',
                    }}
                >
                    <Button
                        type="text"
                        icon={<DeleteOutlined style={{ color: '#ef4444', fontSize: 16 }} />}
                        style={{ color: '#ef4444', width: '100%', textAlign: 'left', padding: '8px 16px', fontWeight: 500 }}
                        onClick={() => handleDeleteTask(selectedTask || null)}
                    >
                        {t('delete')}
                    </Button>
                </div>
            )}
            <div
                className="enhanced-kanban-task-card"
                style={{ background, color, display: 'block', position: 'relative' }}
            >
                {/* Progress circle at top right */}
                <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 2 }}>
                    <TaskProgressCircle task={task} size={20} />
                </div>
                <div
                    draggable
                    onDragStart={e => onTaskDragStart(e, task.id!, groupId)}
                    onDragOver={e => {
                        e.preventDefault();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const offsetY = e.clientY - rect.top;
                        const isDown = offsetY > rect.height / 2;
                        setIsDown(isDown);
                        onTaskDragOver(e, groupId, isDown ? idx + 1 : idx);
                    }}
                    onDrop={e => onTaskDrop(e, groupId, idx)}
                    onDragEnd={onDragEnd} // <-- add this
                    onClick={e => handleCardClick(e, task.id!)}
                    onContextMenu={e => {
                        e.preventDefault();
                        setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
                        setSelectedTask(task);
                    }}
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
                                        borderRadius: '2px',
                                        padding: '0px 4px',
                                        color: themeMode === 'dark' ? '#181818' : '#fff',
                                        fontSize: 10,
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
                            <span
                                className="w-2 h-2 rounded-full inline-block"
                                style={{ backgroundColor: themeMode === 'dark' ? (task.priority_color_dark || task.priority_color || '#d9d9d9') : (task.priority_color || '#d9d9d9') }}
                            ></span>
                            <div className="task-title" title={task.name} style={{ marginLeft: 8 }}>{task.name}</div>
                        </div>

                        <div className="task-assignees-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <div className="relative">
                                <div
                                    ref={dateButtonRef}
                                    className="task-due-date cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1 py-0.5 transition-colors"
                                    style={{
                                        fontSize: 10,
                                        color: '#888',
                                        marginRight: 8,
                                        whiteSpace: 'nowrap',
                                        display: 'inline-block',
                                    }}
                                    onClick={handleDateClick}
                                    title={t('clickToChangeDate')}
                                >
                                    {isUpdating ? (
                                        <div className="w-3 h-3 border border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                                    ) : (
                                        selectedDate ? format(selectedDate, 'MMM d, yyyy') : t('noDueDate')
                                    )}
                                </div>
                                {/* Custom Calendar Popup */}
                                {showDatePicker && dropdownPosition && (
                                    <Portal>
                                        <div
                                            className="w-52 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-[9999] p-1"
                                            style={{
                                                position: 'absolute',
                                                top: dropdownPosition.top,
                                                left: dropdownPosition.left,
                                            }}
                                            ref={datePickerRef}
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <div className="flex items-center justify-between mb-0.5">
                                                <button
                                                    className="px-0.5 py-0.5 text-[10px] rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                                    onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
                                                    type="button"
                                                >
                                                    &lt;
                                                </button>
                                                <span className="font-semibold text-xs text-gray-800 dark:text-gray-100">
                                                    {calendarMonth.toLocaleString('default', { month: 'long' })} {year}
                                                </span>
                                                <button
                                                    className="px-0.5 py-0.5 text-[10px] rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                                    onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
                                                    type="button"
                                                >
                                                    &gt;
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-7 gap-0.5 mb-0.5 text-[10px] text-center">
                                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                                    <div key={d} className="font-medium text-gray-500 dark:text-gray-400">{d}</div>
                                                ))}
                                                {weeks.map((week, i) => (
                                                    <React.Fragment key={i}>
                                                        {week.map((date, j) => {
                                                            const isSelected = date && selectedDate && date.toDateString() === selectedDate.toDateString();
                                                            const isToday = date && date.toDateString() === today.toDateString();
                                                            return (
                                                                <button
                                                                    key={j}
                                                                    className={
                                                                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] ' +
                                                                        (isSelected
                                                                            ? 'bg-blue-600 text-white'
                                                                            : isToday
                                                                                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200'
                                                                                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-100')
                                                                    }
                                                                    style={{ outline: 'none' }}
                                                                    disabled={!date}
                                                                    onClick={() => date && handleDateChange(date)}
                                                                    type="button"
                                                                >
                                                                    {date ? date.getDate() : ''}
                                                                </button>
                                                            );
                                                        })}
                                                    </React.Fragment>
                                                ))}
                                            </div>
                                            <div className="flex gap-0.5 mt-1">
                                                <button
                                                    type="button"
                                                    className="flex-1 px-0.5 py-0.5 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                                    onClick={handleToday}
                                                >
                                                    {t('today')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="px-1 py-0.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                    onClick={handleClearDate}
                                                >
                                                    {t('clear')}
                                                </button>
                                            </div>
                                            <div className="flex gap-1 mt-1">
                                                <button
                                                    type="button"
                                                    className="flex-1 px-1 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                                    onClick={handleTomorrow}
                                                >
                                                    {t('tomorrow')}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="flex-1 px-1 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                                    onClick={handleNextWeek}
                                                >
                                                    {t('nextWeek')}
                                                </button>
                                            </div>
                                        </div>
                                    </Portal>
                                )}
                            </div>
                            <div className="task-assignees" style={{ display: 'flex', alignItems: 'center' }}>
                                <AvatarGroup
                                    members={task.names || []}
                                    maxCount={3}
                                    isDarkMode={themeMode === 'dark'}
                                    size={24}
                                />
                                <LazyAssigneeSelectorWrapper task={task} groupId={groupId} isDarkMode={themeMode === 'dark'} kanbanMode={true} />
                                {(task.sub_tasks_count ?? 0) > 0 && (
                                    <button
                                        type="button"
                                        className={
                                            "ml-2 px-2 py-0.5 rounded-full flex items-center gap-1 text-xs font-medium transition-colors " +
                                            (task.show_sub_tasks
                                                ? "bg-gray-100 dark:bg-gray-800"
                                                : "bg-white dark:bg-[#1e1e1e] hover:bg-gray-50 dark:hover:bg-gray-700")
                                        }
                                        style={{
                                            backgroundColor: themeWiseColor('white', '#1e1e1e', themeMode),
                                            border: "none",
                                            outline: "none",
                                        }}
                                        onClick={handleSubtaskButtonClick}
                                        title={task.show_sub_tasks ? t('hideSubtasks') || 'Hide Subtasks' : t('showSubtasks') || 'Show Subtasks'}
                                    >
                                        {/* Fork/branch icon */}
                                        <svg style={{ color: '#888' }} className="w-2 h-2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 20 20">
                                            <path d="M6 3v2a2 2 0 002 2h4a2 2 0 012 2v2" strokeLinecap="round" />
                                            <circle cx="6" cy="3" r="2" fill="currentColor" />
                                            <circle cx="16" cy="9" r="2" fill="currentColor" />
                                            <circle cx="6" cy="17" r="2" fill="currentColor" />
                                            <path d="M6 5v10" strokeLinecap="round" />
                                        </svg>
                                        <span style={{
                                            fontSize: 10,
                                            color: '#888',
                                            whiteSpace: 'nowrap',
                                            display: 'inline-block',
                                        }}>{task.sub_tasks_count ?? 0}</span>
                                        {/* Caret icon */}
                                        {task.show_sub_tasks ? (
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 20 20">
                                                <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        ) : (
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 20 20">
                                                <path d="M8 6l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div
                    className="subtasks-container"
                    style={{
                        overflow: 'hidden',
                        transition: 'all 0.3s ease-in-out',
                        maxHeight: task.show_sub_tasks ? '500px' : '0px',
                        opacity: task.show_sub_tasks ? 1 : 0,
                        transform: task.show_sub_tasks ? 'translateY(0)' : 'translateY(-10px)',
                    }}
                >
                    <div className="mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">
                        {/* Loading state */}
                        {task.sub_tasks_loading && (
                            <div className="h-4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
                        )}
                        {/* Loaded subtasks */}
                        {!task.sub_tasks_loading && Array.isArray(task.sub_tasks) && task.sub_tasks.length > 0 && (
                            <ul className="space-y-1">
                                {task.sub_tasks.map(sub => (
                                    <li key={sub.id} 
                                    onClick={e => handleCardClick(e, sub.id!)} 
                                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                                    onContextMenu={e => {
                                        e.preventDefault();
                                        setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
                                        setSelectedTask(sub);
                                    }}>
                                        {sub.priority_color || sub.priority_color_dark ? (
                                            <span
                                                className="w-2 h-2 rounded-full inline-block"
                                                style={{ backgroundColor: themeMode === 'dark' ? (sub.priority_color_dark || sub.priority_color || '#d9d9d9') : (sub.priority_color || '#d9d9d9') }}
                                            ></span>
                                        ) : null}
                                        <span className="flex-1 truncate text-xs text-gray-800 dark:text-gray-100" title={sub.name}>{sub.name}</span>
                                        <span
                                            className="task-due-date ml-2 text-[10px] text-gray-500 dark:text-gray-400"
                                        >
                                            {sub.end_date ? format(new Date(sub.end_date), 'MMM d, yyyy') : ''}
                                        </span>
                                        <span className="flex items-center">
                                            {sub.names && sub.names.length > 0 && (
                                                <AvatarGroup
                                                    members={sub.names}
                                                    maxCount={2}
                                                    isDarkMode={themeMode === 'dark'}
                                                    size={18}
                                                />
                                            )}
                                            <LazyAssigneeSelectorWrapper task={sub} groupId={groupId} isDarkMode={themeMode === 'dark'} kanbanMode={true} />
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {/* Empty state */}
                        {!task.sub_tasks_loading && (!Array.isArray(task.sub_tasks) || task.sub_tasks.length === 0) && (
                            <div className="py-2 text-xs text-gray-400 dark:text-gray-500">{t('noSubtasks', 'No subtasks')}</div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
});

TaskCard.displayName = 'TaskCard';

export default TaskCard; 