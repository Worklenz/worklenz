import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  defaultAnimateLayoutChanges,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import EnhancedKanbanTaskCard from './EnhancedKanbanTaskCard';
import VirtualizedTaskList from './VirtualizedTaskList';
import { useAppSelector } from '@/hooks/useAppSelector';
import './EnhancedKanbanGroup.css';
import { Badge, Flex, InputRef, MenuProps, Popconfirm } from '@/shared/antd-imports';
import { themeWiseColor } from '@/utils/themeWiseColor';
import useIsProjectManager from '@/hooks/useIsProjectManager';
import { useAuthService } from '@/hooks/useAuth';
import {
  DeleteOutlined,
  ExclamationCircleFilled,
  EditOutlined,
  LoadingOutlined,
  RetweetOutlined,
  MoreOutlined,
} from '@ant-design/icons/lib/icons';
import { colors } from '@/styles/colors';
import { Input } from '@/shared/antd-imports';
import { Tooltip } from '@/shared/antd-imports';
import { Typography } from '@/shared/antd-imports';
import { Dropdown } from '@/shared/antd-imports';
import { Button } from '@/shared/antd-imports';
import { PlusOutlined } from '@ant-design/icons/lib/icons';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
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
import EnhancedKanbanCreateTaskCard from './EnhancedKanbanCreateTaskCard';

interface EnhancedKanbanGroupProps {
  group: ITaskListGroup;
  activeTaskId?: string | null;
  overId?: string | null;
}

// Performance threshold for virtualization
const VIRTUALIZATION_THRESHOLD = 50;

const EnhancedKanbanGroup: React.FC<EnhancedKanbanGroupProps> = React.memo(
  ({ group, activeTaskId, overId }) => {
    const [isHover, setIsHover] = useState<boolean>(false);
    const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
    const [isEditable, setIsEditable] = useState(false);
    const isProjectManager = useIsProjectManager();
    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState(group.name);
    const inputRef = useRef<InputRef>(null);
    const [editName, setEdit] = useState(group.name);
    const [isEllipsisActive, setIsEllipsisActive] = useState(false);
    const themeMode = useAppSelector(state => state.themeReducer.mode);
    const dispatch = useAppDispatch();
    const { projectId } = useAppSelector(state => state.projectReducer);
    const { groupBy } = useAppSelector(state => state.enhancedKanbanReducer);
    const { statusCategories, status } = useAppSelector(state => state.taskStatusReducer);
    const { trackMixpanelEvent } = useMixpanelTracking();
    const [showNewCardTop, setShowNewCardTop] = useState(false);
    const [showNewCardBottom, setShowNewCardBottom] = useState(false);
    const { t } = useTranslation('kanban-board');

    const { setNodeRef: setDroppableRef, isOver } = useDroppable({
      id: group.id,
      data: {
        type: 'group',
        group,
      },
    });

    // Add sortable functionality for group header
    const {
      attributes,
      listeners,
      setNodeRef: setSortableRef,
      transform,
      transition,
      isDragging: isGroupDragging,
    } = useSortable({
      id: group.id,
      data: {
        type: 'group',
        group,
      },
      animateLayoutChanges: defaultAnimateLayoutChanges,
    });

    const groupRef = useRef<HTMLDivElement>(null);
    const [groupHeight, setGroupHeight] = useState(400);

    // Get task IDs for sortable context
    const taskIds = group.tasks.map(task => task.id!);

    // Check if this group is the target for dropping
    const isTargetGroup = overId === group.id;
    const isDraggingOver = isOver || isTargetGroup;

    // Determine if virtualization should be used
    const shouldVirtualize = useMemo(() => {
      return group.tasks.length > VIRTUALIZATION_THRESHOLD;
    }, [group.tasks.length]);

    // Calculate optimal height for virtualization
    useEffect(() => {
      if (groupRef.current) {
        const containerHeight = Math.min(
          Math.max(group.tasks.length * 80, 200), // Minimum 200px, scale with tasks
          600 // Maximum 600px
        );
        setGroupHeight(containerHeight);
      }
    }, [group.tasks.length]);

    // Memoize task rendering to prevent unnecessary re-renders
    const renderTask = useMemo(
      () => (task: any, index: number) => (
        <EnhancedKanbanTaskCard
          key={task.id}
          sectionId={group.id}
          task={task}
          isActive={task.id === activeTaskId}
          isDropTarget={overId === task.id}
        />
      ),
      [activeTaskId, overId]
    );

    // Performance optimization: Only render drop indicators when needed
    const shouldShowDropIndicators = isDraggingOver && !shouldVirtualize;

    // Combine refs for the main container
    const setRefs = (el: HTMLElement | null) => {
      setDroppableRef(el);
      setSortableRef(el);
    };

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isGroupDragging ? 0.5 : 1,
    };
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
      const sectionName = getUniqueSectionName(name);
      const body: ITaskStatusUpdateModel = {
        name: sectionName,
        project_id: projectId,
        category_id: category,
      };
      const res = await statusApiService.updateStatus(group.id, body, projectId);
      if (res.done) {
        dispatch(fetchEnhancedKanbanGroups(projectId));
        dispatch(fetchStatuses(projectId));
        setName(sectionName);
      } else {
        setName(editName);
        logger.error('Error updating status', res.message);
      }
    };

    // Get the appropriate background color based on theme
    const headerBackgroundColor = useMemo(() => {
      if (themeMode === 'dark') {
        return group.color_code_dark || group.color_code || '#1e1e1e';
      }
      return group.color_code || '#f5f5f5';
    }, [themeMode, group.color_code, group.color_code_dark]);

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const taskName = e.target.value;
      setName(taskName);
    };

    const handleBlur = async () => {
      if (name === 'Untitled section') {
        dispatch(fetchEnhancedKanbanGroups(projectId ?? ''));
      }
      setIsEditable(false);

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

    const handlePressEnter = () => {
      setShowNewCardTop(true);
      setShowNewCardBottom(false);
      handleBlur();
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
    const items: MenuProps['items'] = [
      {
        key: '1',
        label: (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              width: '100%',
              gap: '8px',
            }}
            onClick={() => setIsEditable(true)}
          >
            <EditOutlined /> <span>{t('rename')}</span>
          </div>
        ),
      },
      groupBy === IGroupBy.STATUS && {
        key: '2',
        icon: <RetweetOutlined />,
        label: 'Change category',
        children: statusCategories?.map(status => ({
          key: status.id,
          label: (
            <Flex
              gap={8}
              onClick={() => status.id && updateStatus(status.id)}
              style={group.category_id === status.id ? { fontWeight: 700 } : {}}
            >
              <Badge color={status.color_code} />
              {status.name}
            </Flex>
          ),
        })),
      },
      groupBy !== IGroupBy.PRIORITY && {
        key: '3',
        label: (
          <Popconfirm
            title={t('deleteConfirmationTitle')}
            icon={<ExclamationCircleFilled style={{ color: colors.vibrantOrange }} />}
            okText={t('deleteConfirmationOk')}
            cancelText={t('deleteConfirmationCancel')}
            onConfirm={handleDeleteSection}
          >
            <Flex gap={8} align="center" style={{ width: '100%' }}>
              <DeleteOutlined />
              {t('delete')}
            </Flex>
          </Popconfirm>
        ),
      },
    ].filter(Boolean) as MenuProps['items'];

    return (
      <div
        ref={setRefs}
        style={style}
        className={`enhanced-kanban-group ${isDraggingOver ? 'drag-over' : ''} ${isGroupDragging ? 'group-dragging' : ''}`}
      >
        {/* section header */}
        <div
          className="enhanced-kanban-group-header"
          style={{
            backgroundColor: headerBackgroundColor,
          }}
          {...attributes}
          {...listeners}
        >
          {/* <span className="task-count">({group.tasks.length})</span> */}
          <Flex
            style={{
              fontWeight: 600,
              borderRadius: 6,
              width: '100%',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
            onMouseEnter={() => setIsHover(true)}
            onMouseLeave={() => setIsHover(false)}
          >
            <Flex
              gap={6}
              align="center"
              style={{ cursor: 'pointer' }}
              onClick={e => {
                e.stopPropagation();
                if ((isProjectManager || isOwnerOrAdmin) && group.name !== 'Unmapped')
                  setIsEditable(true);
              }}
              onMouseDown={e => {
                e.stopPropagation();
              }}
            >
              {isLoading && <LoadingOutlined style={{ color: colors.darkGray }} />}
              {isEditable ? (
                <Input
                  ref={inputRef}
                  value={name}
                  variant="borderless"
                  style={{
                    backgroundColor: themeWiseColor('white', '#1e1e1e', themeMode),
                  }}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  onPressEnter={handlePressEnter}
                  onMouseDown={e => {
                    e.stopPropagation();
                  }}
                  onKeyDown={e => {
                    e.stopPropagation();
                  }}
                  onClick={e => {
                    e.stopPropagation();
                  }}
                />
              ) : (
                <Tooltip title={isEllipsisActive ? name : null}>
                  <Typography.Text
                    ellipsis={{
                      tooltip: false,
                      onEllipsis: ellipsed => setIsEllipsisActive(ellipsed),
                    }}
                    style={{
                      minWidth: 185,
                      textTransform: 'capitalize',
                      color: themeMode === 'dark' ? '#383838' : '',
                      display: 'inline-block',
                      overflow: 'hidden',
                      userSelect: 'text',
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
                  </Typography.Text>
                </Tooltip>
              )}
            </Flex>

            <div style={{ display: 'flex' }}>
              <Button
                type="text"
                size="small"
                shape="circle"
                // style={{ color: themeMode === 'dark' ? '#383838' : '' }}
                onClick={() => {
                  setShowNewCardTop(true);
                  setShowNewCardBottom(false);
                }}
              >
                <PlusOutlined />
              </Button>

              {(isOwnerOrAdmin || isProjectManager) && name !== 'Unmapped' && (
                <Dropdown
                  overlayClassName="todo-threedot-dropdown"
                  trigger={['click']}
                  menu={{ items }}
                  placement="bottomLeft"
                >
                  <Button type="text" size="small" shape="circle">
                    <MoreOutlined
                      style={{
                        rotate: '90deg',
                        // fontSize: '25px',
                        // color: themeMode === 'dark' ? '#383838' : '',
                      }}
                    />
                  </Button>
                </Dropdown>
              )}
            </div>
          </Flex>
          {/* <h3 title={group.name} style={{ fontSize: 14, fontWeight: 600, color: themeWiseColor('black', '#1e1e1e', themeMode) }}>{group.name}</h3> */}

          {/* {shouldVirtualize && (
          <span className="virtualization-indicator" title="Virtualized for performance">
            ⚡
          </span>
        )} */}
        </div>

        <div className="enhanced-kanban-group-tasks" ref={groupRef}>
          {/* Create card at top */}
          {showNewCardTop && (isOwnerOrAdmin || isProjectManager) && (
            <EnhancedKanbanCreateTaskCard
              sectionId={group.id}
              setShowNewCard={setShowNewCardTop}
              position="top"
            />
          )}
          {group.tasks.length === 0 && isDraggingOver && (
            <div className="drop-preview-empty">
              <div className="drop-indicator">Drop here</div>
            </div>
          )}

          {shouldVirtualize ? (
            // Use virtualization for large task lists
            <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
              <VirtualizedTaskList
                tasks={group.tasks}
                height={groupHeight}
                itemHeight={80}
                activeTaskId={activeTaskId}
                overId={overId}
                onTaskRender={renderTask}
              />
            </SortableContext>
          ) : (
            // Use standard rendering for smaller lists
            <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
              {group.tasks.map((task, index) => (
                <React.Fragment key={task.id}>
                  {/* Drop indicator before the card if this is the drop target */}
                  {overId === task.id && (
                    <div
                      style={{
                        height: 20,
                        background: themeMode === 'dark' ? '#444' : '#e0e0e0',
                        borderRadius: 4,
                        margin: '4px 0',
                        transition: 'background 0.2s',
                      }}
                    />
                  )}
                  <EnhancedKanbanTaskCard
                    task={task}
                    sectionId={group.id}
                    isActive={task.id === activeTaskId}
                    isDropTarget={overId === task.id}
                  />
                  {/* Drop indicator at the end if dropping at the end of the group */}
                  {index === group.tasks.length - 1 && overId === group.id && (
                    <div
                      style={{
                        height: 12,
                        background: themeMode === 'dark' ? '#444' : '#e0e0e0',
                        borderRadius: 4,
                        margin: '8px 0',
                        transition: 'background 0.2s',
                      }}
                    />
                  )}
                </React.Fragment>
              ))}
            </SortableContext>
          )}
          {/* Create card at bottom */}
          {showNewCardBottom && (isOwnerOrAdmin || isProjectManager) && (
            <EnhancedKanbanCreateTaskCard
              sectionId={group.id}
              setShowNewCard={setShowNewCardBottom}
              position="bottom"
            />
          )}
          {/* Footer Add Task Button */}
          {(isOwnerOrAdmin || isProjectManager) && !showNewCardTop && !showNewCardBottom && (
            <Button
              type="text"
              style={{
                height: '38px',
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
        </div>
      </div>
    );
  }
);

export default EnhancedKanbanGroup;
