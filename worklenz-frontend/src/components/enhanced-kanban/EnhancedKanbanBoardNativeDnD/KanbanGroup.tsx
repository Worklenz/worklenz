import React, { memo, useMemo, useState, useRef, useEffect } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import TaskCard from './TaskCard';
import { themeWiseColor } from '@/utils/themeWiseColor';
import EnhancedKanbanCreateTaskCard from '../EnhancedKanbanCreateTaskCard';
import { useTranslation } from 'react-i18next';
import { useAuthService } from '@/hooks/useAuth';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { ITaskStatusUpdateModel } from '@/types/tasks/task-status-update-model.types';
import { statusApiService } from '@/api/taskAttributes/status/status.api.service';
import { fetchStatuses } from '@/features/taskAttributes/taskStatusSlice';
import logger from '@/utils/errorLogger';
import { evt_project_board_column_setting_click } from '@/shared/worklenz-analytics-events';
import { phasesApiService } from '@/api/taskAttributes/phases/phases.api.service';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  deleteStatusToggleDrawer,
  seletedStatusCategory,
} from '@/features/projects/status/DeleteStatusSlice';
import {
  fetchEnhancedKanbanGroups,
  IGroupBy,
  toggleGroupCollapse,
} from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { Modal, Dropdown, Badge } from '@/shared/antd-imports';
// @ts-ignore: Heroicons module types
import {
  EllipsisHorizontalIcon,
  PencilIcon,
  ArrowPathIcon,
  TrashIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { getContrastColor } from '@/utils/colorUtils';
import useTaskCreationPermission from '@/hooks/useTaskCreationPermission';

// Simple Portal component - removed as it's no longer used

const ExampleKanbanCards = ({
  isDarkMode,
  onClick,
}: {
  isDarkMode: boolean;
  onClick: () => void;
}) => {
  const { t } = useTranslation('kanban-board');
  const [showText, setShowText] = useState(false);

  const exampleNames = [
    t('exampleTasks.task1', { defaultValue: 'Define project scope' }),
    t('exampleTasks.task2', { defaultValue: 'Review with stakeholders' }),
    t('exampleTasks.task3', { defaultValue: 'Schedule kickoff' }),
  ];
  const egPrefix = t('exampleTasks.prefix', { defaultValue: 'e.g.' });

  useEffect(() => {
    const timer = setTimeout(() => setShowText(true), 350);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ padding: 8 }}>
      {exampleNames.map((name, i) => (
        <div
          key={i}
          className="enhanced-kanban-task-card"
          style={{
            display: 'block',
            position: 'relative',
            cursor: 'text',
            background: isDarkMode ? '#1e1e1e' : '#fff',
            color: isDarkMode ? '#e0e0e0' : '#181818',
          }}
          onClick={onClick}
        >
          {/* Labels row — empty, matches height of a card with no labels */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 4, minHeight: 0 }} />

          {/* Title row */}
          <div className="task-content" style={{ display: 'flex', alignItems: 'center' }}>
            <div
              className="task-title"
              style={{
                opacity: showText ? 0.45 : 0,
                transition: 'opacity 0.25s ease-in',
                marginBottom: 4,
                color: isDarkMode ? '#9ca3af' : '#9ca3af',
              }}
            >
              {egPrefix} {name}
            </div>
          </div>

          {/* Bottom row: date left, assignee placeholder right */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              opacity: showText ? 0.25 : 0,
              transition: 'opacity 0.25s ease-in',
            }}
          >
            <div style={{ fontSize: 10, color: isDarkMode ? '#6b7280' : '#aaa' }}>—</div>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: isDarkMode ? '#374151' : '#e8e8e8',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

interface KanbanGroupProps {
  group: ITaskListGroup;
  onGroupDragStart: (e: React.DragEvent, groupId: string) => void;
  onGroupDragOver: (e: React.DragEvent) => void;
  onGroupDrop: (e: React.DragEvent, groupId: string) => void;
  onTaskDragStart: (e: React.DragEvent, taskId: string, groupId: string) => void;
  onTaskDragOver: (e: React.DragEvent, groupId: string, taskIdx: number | null) => void;
  onTaskDrop: (e: React.DragEvent, groupId: string, taskIdx: number | null) => void;
  onDragEnd: (e: React.DragEvent) => void;
  hoveredTaskIdx: number | null;
  hoveredGroupId: string | null;
}

const KanbanGroup: React.FC<KanbanGroupProps> = memo(
  ({
    group,
    onGroupDragStart,
    onGroupDragOver,
    onGroupDrop,
    onTaskDragStart,
    onTaskDragOver,
    onTaskDrop,
    onDragEnd,
    hoveredTaskIdx,
    hoveredGroupId,
  }) => {
    const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
    const [isEditable, setIsEditable] = useState(false);
    const isProjectManager = useIsProjectManager();
    const { canCreateTask } = useTaskCreationPermission();
    const [name, setName] = useState(group.name);
    const inputRef = useRef<HTMLInputElement>(null);
    const [dropdownVisible, setDropdownVisible] = useState(false);
    const [isChangingCategory, setIsChangingCategory] = useState(false);
    const themeMode = useAppSelector(state => state.themeReducer.mode);
    const dispatch = useAppDispatch();
    const { projectId } = useAppSelector(state => state.projectReducer);
    const { groupBy, collapsedGroups } = useAppSelector(state => state.enhancedKanbanReducer);
    const { statusCategories, status } = useAppSelector(state => state.taskStatusReducer);
    const { trackMixpanelEvent } = useMixpanelTracking();
    const [showNewCardTop, setShowNewCardTop] = useState(false);
    const [showNewCardBottom, setShowNewCardBottom] = useState(false);
    const { t } = useTranslation('kanban-board');
    
    // Track if user is dragging (to prevent click-to-expand during drag)
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef<{ x: number; y: number } | null>(null);
    const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Check if this group is collapsed
    const isCollapsed = collapsedGroups[group.id] || false;

    const handleToggleCollapse = (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(toggleGroupCollapse(group.id));
    };
    
    // Handle drag start - track position and set dragging state
    const handleHeaderDragStart = (e: React.DragEvent) => {
      setIsDragging(true);
      dragStartPos.current = { x: e.clientX, y: e.clientY };
      onGroupDragStart(e, group.id);
    };
    
    // Handle drag end - reset dragging state after a small delay
    const handleHeaderDragEnd = (e: React.DragEvent) => {
      onDragEnd(e);
      
      // Clear any existing timeout
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
      
      // Reset dragging state after a small delay to prevent click event
      dragTimeoutRef.current = setTimeout(() => {
        setIsDragging(false);
        dragStartPos.current = null;
      }, 100);
    };
    
    // Cleanup timeout on unmount
    useEffect(() => {
      return () => {
        if (dragTimeoutRef.current) {
          clearTimeout(dragTimeoutRef.current);
        }
      };
    }, []);
    
    // Handle click - only expand if not dragging
    const handleHeaderClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      
      // Don't expand if user was dragging
      if (isDragging) {
        return;
      }
      
      // When collapsed, clicking anywhere expands
      if (isCollapsed) {
        handleToggleCollapse(e);
      } else if ((isProjectManager || isOwnerOrAdmin) && group.name !== t('unmapped')) {
        setIsEditable(true);
      }
    };

    const headerBackgroundColor = useMemo(() => {
      if (themeMode === 'dark') {
        return group.color_code_dark || group.color_code || '#1e1e1e';
      }
      return group.color_code || '#f5f5f5';
    }, [themeMode, group.color_code, group.color_code_dark]);
    const headerTextColor = useMemo(
      () => getContrastColor(headerBackgroundColor),
      [headerBackgroundColor]
    );

    const updateStatus = async (category = group.category_id ?? null) => {
      if (!category || !projectId || !group.id) return;
      const body: ITaskStatusUpdateModel = {
        name: name.trim(),
        project_id: projectId,
        category_id: category,
      };
      const res = await statusApiService.updateStatus(group.id, body, projectId);
      if (res.done) {
        dispatch(fetchEnhancedKanbanGroups(projectId));
        dispatch(fetchStatuses(projectId));
        setName(name.trim());
      } else {
        setName(group.name);
        logger.error('Error updating status', res.message);
      }
    };

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const taskName = e.target.value;
      setName(taskName);
    };

    const handleBlur = async () => {
      setIsEditable(false);
      if (name === group.name) return;
      if (name === t('untitledSection')) {
        dispatch(fetchEnhancedKanbanGroups(projectId ?? ''));
      }

      if (!projectId || !group.id) return;

      if (groupBy === IGroupBy.STATUS) {
        await updateStatus();
      }

      if (groupBy === IGroupBy.PHASE) {
        const body = {
          id: group.id,
          name: name,
        };

        const res = await phasesApiService.updateNameOfPhase(
          group.id,
          body as ITaskPhase,
          projectId
        );
        if (res.done) {
          trackMixpanelEvent(evt_project_board_column_setting_click, { Rename: 'Phase' });
          dispatch(fetchEnhancedKanbanGroups(projectId));
        }
      }
    };

    const handlePressEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        setShowNewCardTop(true);
        setShowNewCardBottom(false);
        handleBlur();
      }
    };

    const handleDeleteSection = async () => {
      if (!projectId || !group.id) return;

      try {
        if (groupBy === IGroupBy.STATUS) {
          const replacingStatusId = '';
          const res = await statusApiService.deleteStatus(group.id, projectId, replacingStatusId);
          if (res.message === 'At least one status should exists under each category.') return;
          if (res.done) {
            dispatch(fetchEnhancedKanbanGroups(projectId));
          } else {
            dispatch(
              seletedStatusCategory({
                id: group.id,
                name: name,
                category_id: group.category_id ?? '',
                message: res.message ?? '',
              })
            );
            dispatch(deleteStatusToggleDrawer());
          }
        } else if (groupBy === IGroupBy.PHASE) {
          const res = await phasesApiService.deletePhaseOption(group.id, projectId);
          if (res.done) {
            dispatch(fetchEnhancedKanbanGroups(projectId));
          }
        }
      } catch (error) {
        logger.error('Error deleting section', error);
      }
    };

    const handleRename = () => {
      setIsEditable(true);
      setDropdownVisible(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select(); // Select all text on focus
        }
      }, 100);
    };

    const handleCategoryChange = async (categoryId: string) => {
      if (!projectId || !group.id || isChangingCategory) return;

      setIsChangingCategory(true);
      setDropdownVisible(false);
      try {
        await statusApiService.updateStatusCategory(group.id, categoryId, projectId);
        trackMixpanelEvent(evt_project_board_column_setting_click, { 'Change category': 'Status' });
        dispatch(fetchEnhancedKanbanGroups(projectId));
        dispatch(fetchStatuses(projectId));
      } catch (error) {
        logger.error('Error changing category', error);
      } finally {
        setIsChangingCategory(false);
      }
    };

    const handleDelete = () => {
      if (groupBy === IGroupBy.STATUS) {
        Modal.confirm({
          title: t('deleteStatusTitle'),
          content: t('deleteStatusContent'),
          okText: t('deleteTaskConfirm'),
          okType: 'danger',
          cancelText: t('deleteTaskCancel'),
          centered: true,
          onOk: async () => {
            await handleDeleteSection();
          },
        });
      } else if (groupBy === IGroupBy.PHASE) {
        Modal.confirm({
          title: t('deletePhaseTitle'),
          content: t('deletePhaseContent'),
          okText: t('deleteTaskConfirm'),
          okType: 'danger',
          cancelText: t('deleteTaskCancel'),
          centered: true,
          onOk: async () => {
            await handleDeleteSection();
          },
        });
      } else {
        Modal.confirm({
          title: t('deleteConfirmationTitle'),
          okText: t('deleteTaskConfirm'),
          okType: 'danger',
          cancelText: t('deleteTaskCancel'),
          centered: true,
          onOk: async () => {
            await handleDeleteSection();
          },
        });
      }
      setDropdownVisible(false);
    };

    // Check if this is the Unmapped phase (should not be editable)
    const isUnmappedPhase = useMemo(() => {
      return (
        groupBy === IGroupBy.PHASE && (group.id === 'Unmapped' || group.name === t('unmapped'))
      );
    }, [groupBy, group.id, group.name, t]);

    // Create dropdown menu items
    const menuItems = useMemo(() => {
      if (!isOwnerOrAdmin && !isProjectManager) return [];

      // Don't show menu for Unmapped phase or priority grouping
      if (isUnmappedPhase || groupBy === IGroupBy.PRIORITY) return [];

      const items = [
        {
          key: 'rename',
          icon: <PencilIcon className="h-4 w-4" />,
          label:
            groupBy === IGroupBy.STATUS
              ? t('renameStatus')
              : groupBy === IGroupBy.PHASE
                ? t('renamePhase')
                : t('rename'),
          onClick: (e: any) => {
            e?.domEvent?.stopPropagation();
            handleRename();
          },
        },
      ];

      // Only show "Change Category" when grouped by status
      if (groupBy === IGroupBy.STATUS && statusCategories) {
        const categorySubMenuItems = statusCategories.map(category => ({
          key: `category-${category.id}`,
          label: (
            <div className="flex items-center gap-2">
              <Badge color={category.color_code} />
              <span>{category.name}</span>
            </div>
          ),
          onClick: (info: any) => {
            info?.domEvent?.stopPropagation();
            handleCategoryChange(category.id || '');
          },
        }));

        items.push({
          key: 'changeCategory',
          icon: <ArrowPathIcon className="h-4 w-4" />,
          label: t('changeCategory'),
          children: categorySubMenuItems,
          onTitleClick: (info: any) => {
            info?.domEvent?.stopPropagation();
          },
        } as any);
      }

      // Add delete option
      items.push({
        key: 'delete',
        icon: <TrashIcon className="h-4 w-4" />,
        label: t('delete'),
        onClick: (e: any) => {
          e?.domEvent?.stopPropagation();
          handleDelete();
        },
        danger: true,
      } as any);

      return items;
    }, [
      groupBy,
      handleRename,
      handleCategoryChange,
      handleDelete,
      isOwnerOrAdmin,
      isProjectManager,
      isUnmappedPhase,
      statusCategories,
      t,
    ]);

    // Close dropdown when clicking outside - remove this since we're using Ant Design Dropdown
    // useEffect(() => {
    //   const handleClickOutside = (event: MouseEvent) => {
    //     if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
    //       setShowDropdown(false);
    //     }
    //   };

    //   if (showDropdown) {
    //     document.addEventListener('mousedown', handleClickOutside);
    //   }

    //   return () => {
    //     document.removeEventListener('mousedown', handleClickOutside);
    //   };
    // }, [showDropdown]);

    return (
      <div 
        className={`enhanced-kanban-group ${isCollapsed ? 'collapsed' : ''}`}
        style={{ 
          position: 'relative',
          // When collapsed, make the group much more compact
          minHeight: isCollapsed ? 'auto' : undefined,
        }}
      >
        {/* Background layer - only show when expanded */}
        {!isCollapsed && (
          <div
            className="enhanced-kanban-group-background"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: `0.1px solid ${themeMode === 'dark' ? '#404040' : '#e0e0e0'}`,
              borderRadius: '8px',
              zIndex: 0,
            }}
            onDragOver={e => {
              e.preventDefault();
              onTaskDragOver(e, group.id, null);
            }}
            onDrop={e => {
              e.preventDefault();
              onTaskDrop(e, group.id, null);
            }}
          />
        )}

        {/* Content layer - z-index 1 */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            className="enhanced-kanban-group-header"
            style={{
              backgroundColor: headerBackgroundColor,
            }}
            draggable={true} // Always draggable for group reordering
            onDragStart={handleHeaderDragStart}
            onDragOver={onGroupDragOver}
            onDrop={e => onGroupDrop(e, group.id)}
            onDragEnd={handleHeaderDragEnd}
          >
            <div className="flex items-center justify-between w-full font-semibold rounded-md">
              <div
                className="flex items-center gap-2 cursor-pointer flex-1"
                onClick={handleHeaderClick}
                onMouseDown={e => {
                  e.stopPropagation();
                }}
              >
                {/* Collapse/Expand Icon */}
                <button
                  type="button"
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-black/10 transition-colors flex-shrink-0"
                  onClick={handleToggleCollapse}
                  title={isCollapsed ? t('expand', { defaultValue: 'Expand' }) : t('collapse', { defaultValue: 'Collapse' })}
                >
                  {isCollapsed ? (
                    <ChevronRightIcon className="w-4 h-4" style={{ color: headerTextColor }} />
                  ) : (
                    <ChevronDownIcon className="w-4 h-4" style={{ color: headerTextColor }} />
                  )}
                </button>

                {isEditable && !isCollapsed ? (
                  <input
                    ref={inputRef}
                    value={name}
                    className="bg-transparent border-none outline-none text-sm font-semibold capitalize min-w-[185px]"
                    style={{ color: headerTextColor }}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handlePressEnter}
                    onMouseDown={e => {
                      e.stopPropagation();
                    }}
                    onClick={e => {
                      e.stopPropagation();
                    }}
                  />
                ) : (
                  <div
                    className="text-sm font-semibold capitalize truncate"
                    style={{ 
                      color: headerTextColor,
                    }}
                    onMouseDown={e => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                    onMouseUp={e => {
                      e.stopPropagation();
                    }}
                    onClick={e => {
                      e.stopPropagation();
                    }}
                  >
                    {name} ({group.tasks.length})
                  </div>
                )}
              </div>

              {/* Only show action buttons when expanded */}
              {!isCollapsed && canCreateTask && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors"
                    onClick={() => {
                      setShowNewCardTop(true);
                      setShowNewCardBottom(false);
                    }}
                  >
                    <svg
                      className="w-4 h-4"
                      style={{ color: headerTextColor }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>

                  {(isOwnerOrAdmin || isProjectManager) && menuItems.length > 0 && (
                    <Dropdown
                      menu={{ items: menuItems }}
                      trigger={['click']}
                      open={dropdownVisible}
                      onOpenChange={setDropdownVisible}
                      placement="bottomRight"
                      overlayStyle={{ zIndex: 1000 }}
                    >
                      <button
                        type="button"
                        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors"
                        onClick={e => {
                          e.stopPropagation();
                          setDropdownVisible(!dropdownVisible);
                        }}
                      >
                        <EllipsisHorizontalIcon className="w-4 h-4" style={{ color: headerTextColor }} />
                      </button>
                    </Dropdown>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Simple Delete Confirmation */}
          {/* Portal-based confirmation removed, now handled by Modal.confirm */}
          
          {/* Tasks section - hidden when collapsed */}
          {!isCollapsed && (
            <div className="enhanced-kanban-group-tasks">
              {/* Create card at top */}
              {(showNewCardTop && canCreateTask ) && (
                <EnhancedKanbanCreateTaskCard
                  sectionId={group.id}
                  setShowNewCard={setShowNewCardTop}
                  position="top"
                />
              )}

            {/* If group is empty, show example task cards as drop zone */}
            {group.tasks.length === 0 &&
              !showNewCardTop &&
              !showNewCardBottom &&
              hoveredGroupId !== group.id && (
                <div
                  className="empty-drop-zone"
                  style={{ borderRadius: 6 }}
                  onDragOver={e => {
                    e.preventDefault();
                    onTaskDragOver(e, group.id, 0);
                  }}
                  onDrop={e => {
                    e.preventDefault();
                    onTaskDrop(e, group.id, 0);
                  }}
                >
                  <ExampleKanbanCards
                    isDarkMode={themeMode === 'dark'}
                    onClick={() => {
                      setShowNewCardBottom(false);
                      setShowNewCardTop(true);
                    }}
                  />
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
                {/* Drop indicator before this card */}
                {hoveredGroupId === group.id && hoveredTaskIdx === idx && (
                  <div
                    onDragOver={e => onTaskDragOver(e, group.id, idx)}
                    onDrop={e => onTaskDrop(e, group.id, idx)}
                  >
                    <div
                      className="w-full h-full bg-red-500"
                      style={{
                        height: 80,
                        background: themeMode === 'dark' ? '#2a2a2a' : '#E2EAF4',
                        borderRadius: 6,
                        border: `5px`,
                      }}
                    ></div>
                  </div>
                )}
                <TaskCard
                  task={task}
                  onTaskDragStart={onTaskDragStart}
                  onTaskDragOver={onTaskDragOver}
                  onTaskDrop={onTaskDrop}
                  groupId={group.id}
                  idx={idx}
                  onDragEnd={onDragEnd}
                  canCreateTask={canCreateTask}
                />
              </React.Fragment>
            ))}
            {/* Drop indicator at the end of the group */}
            {hoveredGroupId === group.id && hoveredTaskIdx === group.tasks.length && (
              <div
                onDragOver={e => onTaskDragOver(e, group.id, group.tasks.length)}
                onDrop={e => onTaskDrop(e, group.id, group.tasks.length)}
              >
                <div
                  className="w-full h-full bg-red-500"
                  style={{
                    height: 80,
                    background: themeMode === 'dark' ? '#2a2a2a' : '#E2EAF4',
                    borderRadius: 6,
                    border: `5px`,
                  }}
                ></div>
              </div>
            )}

            {/* Create card at bottom */}
            {(showNewCardBottom && canCreateTask) && (
              <EnhancedKanbanCreateTaskCard
                sectionId={group.id}
                setShowNewCard={setShowNewCardBottom}
                position="bottom"
              />
            )}

            {/* Footer Add Task Button */}
            {!showNewCardTop && !showNewCardBottom && group.tasks.length > 0 && canCreateTask && (
              <button
                type="button"
                className="h-10 w-full rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-colors flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mt-2"
                onClick={() => {
                  setShowNewCardBottom(true);
                  setShowNewCardTop(false);
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                {t('addTask')}
              </button>
            )}
          </div>
          )}
        </div>
      </div>
    );
  }
);

KanbanGroup.displayName = 'KanbanGroup';

export default KanbanGroup;
