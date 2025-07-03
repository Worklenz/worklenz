import React, { memo, useMemo, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import TaskCard from './TaskCard';
import { themeWiseColor } from '@/utils/themeWiseColor';
import EnhancedKanbanCreateTaskCard from '../EnhancedKanbanCreateTaskCard';
import { PlusOutlined } from '@ant-design/icons';
import Button from 'antd/es/button';
import { useTranslation } from 'react-i18next';
import { useAuthService } from '@/hooks/useAuth';
import useIsProjectManager from '@/hooks/useIsProjectManager';

interface KanbanGroupProps {
    group: ITaskListGroup;
    onGroupDragStart: (e: React.DragEvent, groupId: string) => void;
    onGroupDragOver: (e: React.DragEvent) => void;
    onGroupDrop: (e: React.DragEvent, groupId: string) => void;
    onTaskDragStart: (e: React.DragEvent, taskId: string, groupId: string) => void;
    onTaskDragOver: (e: React.DragEvent, groupId: string, taskIdx: number) => void;
    onTaskDrop: (e: React.DragEvent, groupId: string, taskIdx: number) => void;
    hoveredTaskIdx: number | null;
    hoveredGroupId: string | null;
}

const KanbanGroup: React.FC<KanbanGroupProps> = memo(({
    group,
    onGroupDragStart,
    onGroupDragOver,
    onGroupDrop,
    onTaskDragStart,
    onTaskDragOver,
    onTaskDrop,
    hoveredTaskIdx,
    hoveredGroupId
}) => {
    const themeMode = useAppSelector(state => state.themeReducer.mode);
    const { t } = useTranslation('kanban-board');
    const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
    const isProjectManager = useIsProjectManager();
    const [showNewCardTop, setShowNewCardTop] = useState(false);
    const [showNewCardBottom, setShowNewCardBottom] = useState(false);
    const headerBackgroundColor = useMemo(() => {
        if (themeMode === 'dark') {
            return group.color_code_dark || group.color_code || '#1e1e1e';
        }
        return group.color_code || '#f5f5f5';
    }, [themeMode, group.color_code, group.color_code_dark]);

    return (
        <div className="enhanced-kanban-group">
            <div
                className="enhanced-kanban-group-header"
                style={{
                    backgroundColor: headerBackgroundColor,
                }}
                draggable
                onDragStart={e => onGroupDragStart(e, group.id)}
                onDragOver={onGroupDragOver}
                onDrop={e => onGroupDrop(e, group.id)}
            >
                <h3>{group.name}</h3>
                <span className="task-count">{group.tasks.length}</span>
            </div>
            <div className="enhanced-kanban-group-tasks">
                {/* If group is empty, render a drop zone */}
                {group.tasks.length === 0 && (
                    <div
                        className="empty-drop-zone"
                        style={{
                            padding: 8,
                            height: 500,
                            background: themeWiseColor(
                                'linear-gradient( 180deg, #fafafa, rgba(245, 243, 243, 0))',
                                'linear-gradient( 180deg, #2a2b2d, rgba(42, 43, 45, 0))',
                                themeMode
                            ),
                            borderRadius: 6,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            paddingTop: 8,
                            color: '#888',
                            fontStyle: 'italic',
                        }}
                        onDragOver={e => { e.preventDefault(); onTaskDragOver(e, group.id, 0); }}
                        onDrop={e => { e.preventDefault(); onTaskDrop(e, group.id, 0); }}
                    >
                        {/* Drop indicator at the end of the group */}
                        {hoveredGroupId === group.id && hoveredTaskIdx === group.tasks.length && (
                            <div className="drop-preview-indicator">
                                <div className="drop-line" />
                            </div>
                        )}
                        {(isOwnerOrAdmin || isProjectManager) && !showNewCardTop && !showNewCardBottom && (
                            <Button
                                type="text"
                                style={{
                                    height: '38px',
                                    width: '100%',
                                    borderRadius: 6,
                                    boxShadow: 'none',
                                }}
                                icon={<PlusOutlined />}
                                onClick={() => {
                                    setShowNewCardBottom(false);
                                    setShowNewCardTop(true);
                                }}
                            >
                                {t('addTask')}
                            </Button>
                        )}
                        {showNewCardTop && <EnhancedKanbanCreateTaskCard sectionId={group.id} setShowNewCard={setShowNewCardTop} position='top' />}
                    </div>
                )}

                {/* Drop indicator at the top of the group */}
                {hoveredGroupId === group.id && hoveredTaskIdx === 0 && (
                    <div className="drop-preview-indicator">
                        <div className="drop-line" />
                    </div>
                )}

                {group.tasks.map((task, idx) => (
                    <React.Fragment key={task.id}>
                        <TaskCard
                            task={task}
                            onTaskDragStart={onTaskDragStart}
                            onTaskDragOver={onTaskDragOver}
                            onTaskDrop={onTaskDrop}
                            groupId={group.id}
                            isDropIndicator={hoveredGroupId === group.id && hoveredTaskIdx === idx}
                            idx={idx}
                        />
                    </React.Fragment>
                ))}
                {(isOwnerOrAdmin || isProjectManager) && !showNewCardTop && !showNewCardBottom && group.tasks.length > 0 && (
                    <Button
                        type="text"
                        style={{
                            height: '40px',
                            width: '100%',
                            borderRadius: 6,
                            boxShadow: 'none',
                            marginTop: 8,
                        }}
                        icon={<PlusOutlined />}
                        onClick={() => {
                            setShowNewCardBottom(true);
                            setShowNewCardTop(false);
                        }}
                    >
                        {t('addTask')}
                    </Button>
                )}
                {showNewCardBottom && <EnhancedKanbanCreateTaskCard sectionId={group.id} setShowNewCard={setShowNewCardBottom} position='bottom' />}

                {/* Drop indicator at the end of the group */}
                {hoveredGroupId === group.id && hoveredTaskIdx === group.tasks.length && (
                    <div className="drop-preview-indicator">
                        <div className="drop-line" />
                    </div>
                )}  
            </div>
        </div>
    );
});

KanbanGroup.displayName = 'KanbanGroup';

export default KanbanGroup; 