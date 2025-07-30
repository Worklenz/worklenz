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
} from '@/features/enhanced-kanban/enhanced-kanban.slice';
import { createPortal } from 'react-dom';
import { Modal } from 'antd';

// Simple Portal component
const Portal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const portalRoot = document.getElementById('portal-root') || document.body;
  return createPortal(children, portalRoot);
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
    const [isHover, setIsHover] = useState<boolean>(false);
    const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
    const [isEditable, setIsEditable] = useState(false);
    const isProjectManager = useIsProjectManager();
    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState(group.name);
    const inputRef = useRef<HTMLInputElement>(null);
    const [editName, setEdit] = useState(group.name);
    const [isEllipsisActive, setIsEllipsisActive] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const themeMode = useAppSelector(state => state.themeReducer.mode);
    const dispatch = useAppDispatch();
    const { projectId } = useAppSelector(state => state.projectReducer);
    const { groupBy } = useAppSelector(state => state.enhancedKanbanReducer);
    const { statusCategories, status } = useAppSelector(state => state.taskStatusReducer);
    const { trackMixpanelEvent } = useMixpanelTracking();
    const [showNewCardTop, setShowNewCardTop] = useState(false);
    const [showNewCardBottom, setShowNewCardBottom] = useState(false);
    const { t } = useTranslation('kanban-board');

    const headerBackgroundColor = useMemo(() => {
      if (themeMode === 'dark') {
        return group.color_code_dark || group.color_code || '#1e1e1e';
      }
      return group.color_code || '#f5f5f5';
    }, [themeMode, group.color_code, group.color_code_dark]);

    const getUniqueSectionName = (baseName: string): string => {
      // Check if the base name already exists
      const existingNames = status.map(status => status.name?.toLowerCase());

      if (!existingNames.includes(baseName.toLowerCase())) {
        return baseName;
      }

      // If the base name exists, add a number suffix
      let counter = 1;
      let newName = `${baseName.trim()} (${counter})`;

      while (existingNames.includes(newName.toLowerCase())) {
        counter++;
        newName = `${baseName.trim()} (${counter})`;
      }

      return newName;
    };

    const updateStatus = async (category = group.category_id ?? null) => {
      if (!category || !projectId || !group.id) return;
      // const sectionName = getUniqueSectionName(name);
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
        setName(editName);
        logger.error('Error updating status', res.message);
      }
    };

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const taskName = e.target.value;
      setName(taskName);
    };

    const handleBlur = async () => {
      setIsEditable(false);
      if (name === editName) return;
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
      setShowDropdown(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select(); // Select all text on focus
        }
      }, 100);
    };

    const handleCategoryChange = (categoryId: string) => {
      updateStatus(categoryId);
      setShowDropdown(false);
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
      setShowDropdown(false);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setShowDropdown(false);
        }
      };

      if (showDropdown) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [showDropdown]);

    return (
      <div className="enhanced-kanban-group" style={{ position: 'relative' }}>
        {/* Background layer - z-index 0 */}
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

        {/* Content layer - z-index 1 */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            className="enhanced-kanban-group-header"
            style={{
              backgroundColor: headerBackgroundColor,
            }}
            draggable
            onDragStart={e => onGroupDragStart(e, group.id)}
            onDragOver={onGroupDragOver}
            onDrop={e => onGroupDrop(e, group.id)}
            onDragEnd={onDragEnd}
          >
            <div
              className="flex items-center justify-between w-full font-semibold rounded-md"
              onMouseEnter={() => setIsHover(true)}
              onMouseLeave={() => setIsHover(false)}
            >
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={e => {
                  e.stopPropagation();
                  if ((isProjectManager || isOwnerOrAdmin) && group.name !== t('unmapped'))
                    setIsEditable(true);
                }}
                onMouseDown={e => {
                  e.stopPropagation();
                }}
              >
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                )}
                {isEditable ? (
                  <input
                    ref={inputRef}
                    value={name}
                    className={`bg-transparent border-none outline-none text-sm font-semibold capitalize min-w-[185px] ${
                      themeMode === 'dark' ? 'text-gray-800' : 'text-gray-900'
                    }`}
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
                    className={`min-w-[185px] text-sm font-semibold capitalize truncate ${
                      themeMode === 'dark' ? 'text-gray-800' : 'text-gray-900'
                    }`}
                    title={isEllipsisActive ? name : undefined}
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
                    className="w-4 h-4 text-gray-800"
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

                {(isOwnerOrAdmin || isProjectManager) && name !== t('unmapped') && (
                  <div className="relative" ref={dropdownRef}>
                    <button
                      type="button"
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors"
                      onClick={() => setShowDropdown(!showDropdown)}
                    >
                      <svg
                        className="w-4 h-4 text-gray-800 rotate-90"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                        />
                      </svg>
                    </button>

                    {showDropdown && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                        <div className="py-1">
                          <button
                            type="button"
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            onClick={handleRename}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                            {t('rename')}
                          </button>

                          {groupBy === IGroupBy.STATUS && statusCategories && (
                            <div className="border-t border-gray-200 dark:border-gray-700">
                              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                                {t('changeCategory')}
                              </div>
                              {statusCategories.map(status => (
                                <button
                                  key={status.id}
                                  type="button"
                                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                  onClick={() => status.id && handleCategoryChange(status.id)}
                                >
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: status.color_code }}
                                  ></div>
                                  <span
                                    className={group.category_id === status.id ? 'font-bold' : ''}
                                  >
                                    {status.name}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}

                          {groupBy !== IGroupBy.PRIORITY && (
                            <div className="border-t border-gray-200 dark:border-gray-700">
                              <button
                                type="button"
                                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
                                onClick={e => {
                                  e.stopPropagation();
                                  handleDelete();
                                }}
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                                {t('delete')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Simple Delete Confirmation */}
          {/* Portal-based confirmation removed, now handled by Modal.confirm */}
          <div className="enhanced-kanban-group-tasks">
            {/* Create card at top */}
            {showNewCardTop && (
              <EnhancedKanbanCreateTaskCard
                sectionId={group.id}
                setShowNewCard={setShowNewCardTop}
                position="top"
              />
            )}

            {/* If group is empty, render a drop zone */}
            {group.tasks.length === 0 &&
              !showNewCardTop &&
              !showNewCardBottom &&
              hoveredGroupId !== group.id && (
                <div
                  className="empty-drop-zone"
                  style={{
                    padding: 8,
                    height: 500,
                    background: themeWiseColor(
                      'linear-gradient( 180deg,#E2EAF4, rgba(245, 243, 243, 0))',
                      'linear-gradient( 180deg, #2a2a2a, rgba(42, 43, 45, 0))',
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
                  onDragOver={e => {
                    e.preventDefault();
                    onTaskDragOver(e, group.id, 0);
                  }}
                  onDrop={e => {
                    e.preventDefault();
                    onTaskDrop(e, group.id, 0);
                  }}
                >
                  {(isOwnerOrAdmin || isProjectManager) &&
                    !showNewCardTop &&
                    !showNewCardBottom && (
                      <button
                        type="button"
                        className="h-10 w-full rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-colors flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                        onClick={() => {
                          setShowNewCardBottom(false);
                          setShowNewCardTop(true);
                        }}
                      >
                        <svg
                          className="w-4 h-4"
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
                        {t('addTask')}
                      </button>
                    )}
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
            {showNewCardBottom && (
              <EnhancedKanbanCreateTaskCard
                sectionId={group.id}
                setShowNewCard={setShowNewCardBottom}
                position="bottom"
              />
            )}

            {/* Footer Add Task Button */}
            {!showNewCardTop && !showNewCardBottom && group.tasks.length > 0 && (
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
        </div>
      </div>
    );
  }
);

KanbanGroup.displayName = 'KanbanGroup';

export default KanbanGroup;
