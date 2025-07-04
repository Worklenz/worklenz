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
    isDropIndicator: boolean;
    idx: number;
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
    isDropIndicator,
    idx
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
                                        className="w-80 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-[9999] p-3"
                                        style={{
                                            position: 'absolute',
                                            top: dropdownPosition.top,
                                            left: dropdownPosition.left,
                                        }}
                                        ref={datePickerRef}
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <button
                                                className="px-2 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                                onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
                                                type="button"
                                            >
                                                &lt;
                                            </button>
                                            <span className="font-semibold text-base text-gray-800 dark:text-gray-100">
                                                {calendarMonth.toLocaleString('default', { month: 'long' })} {year}
                                            </span>
                                            <button
                                                className="px-2 py-1 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                                onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
                                                type="button"
                                            >
                                                &gt;
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-7 gap-1 mb-2 text-xs text-center">
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
                                                                    'w-8 h-8 rounded-full flex items-center justify-center ' +
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
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                type="button"
                                                className="flex-1 px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                                onClick={handleToday}
                                            >
                                                {t('today')}
                                            </button>
                                            <button
                                                type="button"
                                                className="px-2 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                onClick={handleClearDate}
                                            >
                                                {t('clear')}
                                            </button>
                                        </div>
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                type="button"
                                                className="flex-1 px-2 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                                onClick={handleTomorrow}
                                            >
                                                {t('tomorrow')}
                                            </button>
                                            <button
                                                type="button"
                                                className="flex-1 px-2 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
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
                            <LazyAssigneeSelectorWrapper task={task} groupId={groupId} isDarkMode={themeMode === 'dark'} />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
});

TaskCard.displayName = 'TaskCard';

export default TaskCard; 