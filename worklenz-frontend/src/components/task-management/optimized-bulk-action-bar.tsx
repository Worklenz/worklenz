import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button, Typography, Dropdown, Popconfirm, Tooltip, Space, Badge, Divider } from '@/shared/antd-imports';
import {
  DeleteOutlined,
  CloseOutlined,
  RetweetOutlined,
  UserAddOutlined,
  InboxOutlined,
  TagsOutlined,
  UsergroupAddOutlined,
  FlagOutlined,
  BulbOutlined,
  MoreOutlined,
} from '@/shared/antd-imports';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/app/store';
import { useAppSelector } from '@/hooks/useAppSelector';
import { selectTasks } from '@/features/projects/bulkActions/bulkActionSlice';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { useTranslation } from 'react-i18next';
import LabelsDropdown from '@/components/taskListCommon/task-list-bulk-actions-bar/components/LabelsDropdown';
import AssigneesDropdown from '@/components/taskListCommon/task-list-bulk-actions-bar/components/AssigneesDropdown';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { InputRef } from 'antd/es/input';
import { CheckboxChangeEvent } from 'antd/es/checkbox';
import TaskTemplateDrawer from '@/components/task-templates/task-template-drawer';
import { useAuthService } from '@/hooks/useAuth';

const { Text } = Typography;

interface OptimizedBulkActionBarProps {
  selectedTaskIds: string[];
  totalSelected: number;
  projectId: string;
  onClearSelection?: () => void;
  onBulkStatusChange?: (statusId: string) => void;
  onBulkPriorityChange?: (priorityId: string) => void;
  onBulkPhaseChange?: (phaseId: string) => void;
  onBulkAssignToMe?: () => void;
  onBulkAssignMembers?: (memberIds: string[]) => void;
  onBulkAddLabels?: (labelIds: string[]) => void;
  onBulkArchive?: () => void;
  onBulkDelete?: () => void;
  onBulkDuplicate?: () => void;
  onBulkExport?: () => void;
  onBulkSetDueDate?: (date: string) => void;
}

// Performance-optimized memoized action button component
const ActionButton = React.memo<{
  icon: React.ReactNode;
  tooltip: string;
  onClick?: () => void;
  loading?: boolean;
  danger?: boolean;
  disabled?: boolean;
  isDarkMode: boolean;
  badge?: number;
}>(
  ({
    icon,
    tooltip,
    onClick,
    loading = false,
    danger = false,
    disabled = false,
    isDarkMode,
    badge,
  }) => {
    const buttonStyle = useMemo(
      () => ({
        background: 'transparent',
        color: isDarkMode ? '#e5e7eb' : '#374151',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px',
        height: '32px',
        width: '32px',
        fontSize: '14px',
        borderRadius: '6px',
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...(danger && {
          color: '#ef4444',
        }),
      }),
      [isDarkMode, danger, disabled]
    );

    const hoverStyle = useMemo(
      () => ({
        backgroundColor: isDarkMode
          ? danger
            ? 'rgba(239, 68, 68, 0.1)'
            : 'rgba(255, 255, 255, 0.1)'
          : danger
            ? 'rgba(239, 68, 68, 0.1)'
            : 'rgba(0, 0, 0, 0.05)',
        transform: 'scale(1.05)',
      }),
      [isDarkMode, danger]
    );

    const [isHovered, setIsHovered] = useState(false);

    const combinedStyle = useMemo(
      () => ({
        ...buttonStyle,
        ...(isHovered && !disabled ? hoverStyle : {}),
      }),
      [buttonStyle, hoverStyle, isHovered, disabled]
    );

    const ButtonComponent = (
      <Button
        icon={icon}
        style={combinedStyle}
        size="small"
        loading={loading}
        disabled={disabled}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        type="text"
      />
    );

    return (
      <Tooltip title={tooltip} placement="top">
        {badge && badge > 0 ? (
          <Badge count={badge} size="small" offset={[-2, 2]}>
            {ButtonComponent}
          </Badge>
        ) : (
          ButtonComponent
        )}
      </Tooltip>
    );
  }
);

ActionButton.displayName = 'ActionButton';

// Performance-optimized main component
const OptimizedBulkActionBarContent: React.FC<OptimizedBulkActionBarProps> = React.memo(
  ({
    selectedTaskIds,
    totalSelected,
    projectId,
    onClearSelection,
    onBulkStatusChange,
    onBulkPriorityChange,
    onBulkPhaseChange,
    onBulkAssignToMe,
    onBulkAssignMembers,
    onBulkAddLabels,
    onBulkArchive,
    onBulkDelete,
    onBulkDuplicate,
    onBulkExport,
    onBulkSetDueDate,
  }) => {
    const { t } = useTranslation(['tasks/task-table-bulk-actions', 'task-management']);
    const dispatch = useDispatch();
    const isDarkMode = useSelector((state: RootState) => state.themeReducer?.mode === 'dark');

    // Get data from Redux store
    const statusList = useAppSelector(state => state.taskStatusReducer.status);
    const priorityList = useAppSelector(state => state.priorityReducer.priorities);
    const phaseList = useAppSelector(state => state.phaseReducer.phaseList);
    const labelsList = useAppSelector(state => state.taskLabelsReducer.labels);
    const members = useAppSelector(state => state.teamMembersReducer.teamMembers);
    const tasks = useAppSelector(state => state.taskManagement.entities);

    // Performance state management
    const [isVisible, setIsVisible] = useState(false);
    const [loadingStates, setLoadingStates] = useState({
      status: false,
      priority: false,
      phase: false,
      assignToMe: false,
      assignMembers: false,
      labels: false,
      archive: false,
      delete: false,
      duplicate: false,
      export: false,
      dueDate: false,
    });

    // Labels dropdown state
    const [selectedLabels, setSelectedLabels] = useState<ITaskLabel[]>([]);
    const [createLabelText, setCreateLabelText] = useState<string>('');
    const labelsInputRef = useRef<InputRef>(null);

    // Assignees dropdown state
    const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);

    // Task template state
    const [showDrawer, setShowDrawer] = useState(false);

    // Auth service for permissions
    const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();

    // Smooth entrance animation
    useEffect(() => {
      if (totalSelected > 0) {
        // Micro-delay for smoother animation
        const timer = setTimeout(() => setIsVisible(true), 50);
        return () => clearTimeout(timer);
      } else {
        setIsVisible(false);
      }
    }, [totalSelected]);

    // Optimized loading state updater
    const updateLoadingState = useCallback(
      (action: keyof typeof loadingStates, loading: boolean) => {
        setLoadingStates(prev => ({ ...prev, [action]: loading }));
      },
      []
    );

    // Create dropdown menus
    const statusMenuItems = useMemo(
      () =>
        statusList.map(status => ({
          key: status.id || '',
          label: <Badge color={status.color_code} text={status.name} />,
        })),
      [statusList]
    );

    const priorityMenuItems = useMemo(
      () =>
        priorityList.map(priority => ({
          key: priority.id || '',
          label: <Badge color={priority.color_code} text={priority.name} />,
        })),
      [priorityList]
    );

    const phaseMenuItems = useMemo(
      () =>
        phaseList.map(phase => ({
          key: phase.id || '',
          label: <Badge color={phase.color_code} text={phase.name} />,
        })),
      [phaseList]
    );

    // Menu click handlers
    const handleStatusMenuClick = useCallback(
      (e: any) => {
        onBulkStatusChange?.(e.key);
      },
      [onBulkStatusChange]
    );

    const handlePriorityMenuClick = useCallback(
      (e: any) => {
        onBulkPriorityChange?.(e.key);
      },
      [onBulkPriorityChange]
    );

    const handlePhaseMenuClick = useCallback(
      (e: any) => {
        onBulkPhaseChange?.(e.key);
      },
      [onBulkPhaseChange]
    );

    const handleLabelsMenuClick = useCallback(
      (e: any) => {
        onBulkAddLabels?.([e.key]);
      },
      [onBulkAddLabels]
    );

    // Labels dropdown handlers
    const handleLabelChange = useCallback((e: CheckboxChangeEvent, label: ITaskLabel) => {
      if (e.target.checked) {
        setSelectedLabels(prev => [...prev, label]);
      } else {
        setSelectedLabels(prev => prev.filter(l => l.id !== label.id));
      }
    }, []);

    const handleApplyLabels = useCallback(async () => {
      if (!projectId) return;
      try {
        updateLoadingState('labels', true);
        const body = {
          tasks: selectedTaskIds,
          labels: selectedLabels,
          text:
            selectedLabels.length > 0
              ? null
              : createLabelText.trim() !== ''
                ? createLabelText.trim()
                : null,
        };
        await onBulkAddLabels?.(
          selectedLabels.map(l => l.id).filter((id): id is string => id !== undefined)
        );
        setCreateLabelText('');
        setSelectedLabels([]);
      } catch (error) {
        // Error handling is done in the parent component
      } finally {
        updateLoadingState('labels', false);
      }
    }, [
      selectedLabels,
      createLabelText,
      selectedTaskIds,
      projectId,
      onBulkAddLabels,
      updateLoadingState,
    ]);

    // Assignees dropdown handlers
    const handleChangeAssignees = useCallback(
      async (selectedAssignees: ITeamMemberViewModel[]) => {
        if (!projectId) return;
        try {
          updateLoadingState('assignMembers', true);
          await onBulkAssignMembers?.(
            selectedAssignees.map(m => m.id).filter((id): id is string => id !== undefined)
          );
        } catch (error) {
          // Error handling is done in the parent component
        } finally {
          updateLoadingState('assignMembers', false);
        }
      },
      [projectId, onBulkAssignMembers, updateLoadingState]
    );

    const onAssigneeDropdownOpenChange = useCallback((open: boolean) => {
      setAssigneeDropdownOpen(open);
    }, []);

    // Get selected task objects for template creation
    const selectedTaskObjects = useMemo(() => {
      return Object.values(tasks).filter((task: any) => selectedTaskIds.includes(task.id));
    }, [tasks, selectedTaskIds]);

    // Update Redux state when opening template drawer
    const handleOpenTemplateDrawer = useCallback(() => {
      // Convert Task objects to IProjectTask format for template creation
      const projectTasks: IProjectTask[] = selectedTaskObjects.map((task: any) => ({
        id: task.id,
        name: task.title, // Always use title as the name
        task_key: task.task_key,
        status: task.status,
        status_id: task.status,
        priority: task.priority,
        phase_id: task.phase,
        phase_name: task.phase,
        description: task.description,
        start_date: task.startDate,
        end_date: task.dueDate,
        total_hours: task.timeTracking?.estimated || 0,
        total_minutes: task.timeTracking?.logged || 0,
        progress: task.progress,
        sub_tasks_count: task.sub_tasks_count || 0,
        assignees:
          task.assignees?.map((assigneeId: string) => ({
            id: assigneeId,
            name: '',
            email: '',
            avatar_url: '',
            team_member_id: assigneeId,
            project_member_id: assigneeId,
          })) || [],
        labels: task.labels || [],
        manual_progress: false,
        created_at: task.createdAt,
        updated_at: task.updatedAt,
        sort_order: task.order,
      }));

      // Update the bulkActionReducer with selected tasks
      dispatch(selectTasks(projectTasks));
      setShowDrawer(true);
    }, [selectedTaskObjects, dispatch]);

    // Labels dropdown content
    const labelsDropdownContent = useMemo(
      () => (
        <LabelsDropdown
          labelsList={labelsList || []}
          themeMode={isDarkMode ? 'dark' : 'light'}
          createLabelText={createLabelText}
          selectedLabels={selectedLabels}
          labelsInputRef={labelsInputRef as React.RefObject<InputRef>}
          onLabelChange={handleLabelChange}
          onCreateLabelTextChange={setCreateLabelText}
          onApply={handleApplyLabels}
          t={t}
          loading={loadingStates.labels}
        />
      ),
      [
        labelsList,
        isDarkMode,
        createLabelText,
        selectedLabels,
        handleLabelChange,
        handleApplyLabels,
        t,
        loadingStates.labels,
      ]
    );

    // Assignees dropdown content
    const assigneesDropdownContent = useMemo(
      () => (
        <AssigneesDropdown
          members={members?.data || []}
          themeMode={isDarkMode ? 'dark' : 'light'}
          onApply={handleChangeAssignees}
          onClose={() => setAssigneeDropdownOpen(false)}
          t={t}
        />
      ),
      [members?.data, isDarkMode, handleChangeAssignees, t]
    );

    // Memoized handlers with loading states
    const handleStatusChange = useCallback(async () => {
      updateLoadingState('status', true);
      try {
        await onBulkStatusChange?.('new-status-id');
      } finally {
        updateLoadingState('status', false);
      }
    }, [onBulkStatusChange, updateLoadingState]);

    const handlePriorityChange = useCallback(async () => {
      updateLoadingState('priority', true);
      try {
        await onBulkPriorityChange?.('new-priority-id');
      } finally {
        updateLoadingState('priority', false);
      }
    }, [onBulkPriorityChange, updateLoadingState]);

    const handlePhaseChange = useCallback(async () => {
      updateLoadingState('phase', true);
      try {
        await onBulkPhaseChange?.('new-phase-id');
      } finally {
        updateLoadingState('phase', false);
      }
    }, [onBulkPhaseChange, updateLoadingState]);

    const handleAssignToMe = useCallback(async () => {
      updateLoadingState('assignToMe', true);
      try {
        await onBulkAssignToMe?.();
      } finally {
        updateLoadingState('assignToMe', false);
      }
    }, [onBulkAssignToMe, updateLoadingState]);

    const handleArchive = useCallback(async () => {
      updateLoadingState('archive', true);
      try {
        await onBulkArchive?.();
      } finally {
        updateLoadingState('archive', false);
      }
    }, [onBulkArchive, updateLoadingState]);

    const handleDelete = useCallback(async () => {
      updateLoadingState('delete', true);
      try {
        await onBulkDelete?.();
      } finally {
        updateLoadingState('delete', false);
      }
    }, [onBulkDelete, updateLoadingState]);

    const handleDuplicate = useCallback(async () => {
      updateLoadingState('duplicate', true);
      try {
        await onBulkDuplicate?.();
      } finally {
        updateLoadingState('duplicate', false);
      }
    }, [onBulkDuplicate, updateLoadingState]);

    const handleExport = useCallback(async () => {
      updateLoadingState('export', true);
      try {
        await onBulkExport?.();
      } finally {
        updateLoadingState('export', false);
      }
    }, [onBulkExport, updateLoadingState]);

    // Memoized styles for better performance
    const containerStyle = useMemo(
      (): React.CSSProperties => ({
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: `translateX(-50%) translateY(${isVisible ? '0' : '20px'})`,
        zIndex: 1000,
        background: isDarkMode ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: '16px',
        padding: '12px 20px',
        boxShadow: isDarkMode
          ? '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(55, 65, 81, 0.3)'
          : '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        minWidth: 'fit-content',
        maxWidth: '90vw',
        opacity: isVisible ? 1 : 0,
        visibility: isVisible ? 'visible' : 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        border: isDarkMode
          ? '1px solid rgba(55, 65, 81, 0.3)'
          : '1px solid rgba(229, 231, 235, 0.8)',
      }),
      [isDarkMode, isVisible]
    );

    const textStyle = useMemo(
      () => ({
        color: isDarkMode ? '#f3f4f6' : '#374151',
        fontSize: '14px',
        fontWeight: 500,
        marginRight: '12px',
        whiteSpace: 'nowrap' as const,
      }),
      [isDarkMode]
    );

    // Remove translation loading check since we're using simple load-as-you-go approach

    if (!totalSelected || Number(totalSelected) < 1) {
      return null;
    }

    return (
      <div style={containerStyle}>
        {/* Selection Count */}
        <Text style={textStyle}>
          <Badge
            count={totalSelected}
            style={{
              backgroundColor: isDarkMode ? '#3b82f6' : '#2563eb',
              color: 'white',
              fontSize: '11px',
              height: '18px',
              lineHeight: '18px',
              minWidth: '18px',
              marginRight: '6px',
            }}
          />
          {t('TASKS_SELECTED', { count: totalSelected })}
        </Text>

        <Divider
          type="vertical"
          style={{
            height: '20px',
            margin: '0 8px',
            borderColor: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.8)',
          }}
        />

        {/* Actions in same order as original component */}
        <Space size={2}>
          {/* Change Status */}
          <Tooltip title={t('CHANGE_STATUS')} placement="top">
            <Dropdown
              menu={{
                items: statusMenuItems,
                onClick: handleStatusMenuClick,
              }}
              trigger={['click']}
              placement="top"
              arrow
            >
              <Button
                icon={<RetweetOutlined />}
                style={{
                  background: 'transparent',
                  color: isDarkMode ? '#e5e7eb' : '#374151',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px',
                  height: '32px',
                  width: '32px',
                  fontSize: '14px',
                  borderRadius: '6px',
                  transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                size="small"
                type="text"
                loading={loadingStates.status}
              />
            </Dropdown>
          </Tooltip>

          {/* Change Priority */}
          <Tooltip title={t('CHANGE_PRIORITY')} placement="top">
            <Dropdown
              menu={{
                items: priorityMenuItems,
                onClick: handlePriorityMenuClick,
              }}
              trigger={['click']}
              placement="top"
              arrow
            >
              <Button
                icon={<FlagOutlined />}
                style={{
                  background: 'transparent',
                  color: isDarkMode ? '#e5e7eb' : '#374151',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px',
                  height: '32px',
                  width: '32px',
                  fontSize: '14px',
                  borderRadius: '6px',
                  transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                size="small"
                type="text"
                loading={loadingStates.priority}
              />
            </Dropdown>
          </Tooltip>

          {/* Change Phase */}
          <Tooltip title={t('CHANGE_PHASE')} placement="top">
            <Dropdown
              menu={{
                items: phaseMenuItems,
                onClick: handlePhaseMenuClick,
              }}
              trigger={['click']}
              placement="top"
              arrow
            >
              <Button
                icon={<BulbOutlined />}
                style={{
                  background: 'transparent',
                  color: isDarkMode ? '#e5e7eb' : '#374151',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px',
                  height: '32px',
                  width: '32px',
                  fontSize: '14px',
                  borderRadius: '6px',
                  transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                size="small"
                type="text"
                loading={loadingStates.phase}
              />
            </Dropdown>
          </Tooltip>

          {/* Change Labels */}
          <Tooltip title={t('ADD_LABELS')} placement="top">
            <Dropdown
              dropdownRender={() => labelsDropdownContent}
              trigger={['click']}
              placement="top"
              arrow
              onOpenChange={open => {
                if (!open) {
                  setSelectedLabels([]);
                  setCreateLabelText('');
                }
              }}
            >
              <Button
                icon={<TagsOutlined />}
                style={{
                  background: 'transparent',
                  color: isDarkMode ? '#e5e7eb' : '#374151',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px',
                  height: '32px',
                  width: '32px',
                  fontSize: '14px',
                  borderRadius: '6px',
                  transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                size="small"
                type="text"
                loading={loadingStates.labels}
              />
            </Dropdown>
          </Tooltip>

          {/* Assign to Me */}
          <ActionButton
            icon={<UserAddOutlined />}
            tooltip={t('ASSIGN_TO_ME')}
            onClick={handleAssignToMe}
            loading={loadingStates.assignToMe}
            isDarkMode={isDarkMode}
          />

          {/* Change Assignees */}
          <Tooltip title={t('ASSIGN_MEMBERS')} placement="top">
            <Dropdown
              dropdownRender={() => assigneesDropdownContent}
              open={assigneeDropdownOpen}
              onOpenChange={onAssigneeDropdownOpenChange}
              trigger={['click']}
              placement="top"
              arrow
            >
              <Button
                icon={<UsergroupAddOutlined />}
                style={{
                  background: 'transparent',
                  color: isDarkMode ? '#e5e7eb' : '#374151',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '6px',
                  height: '32px',
                  width: '32px',
                  fontSize: '14px',
                  borderRadius: '6px',
                  transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                size="small"
                type="text"
                loading={loadingStates.assignMembers}
              />
            </Dropdown>
          </Tooltip>

          {/* Archive */}
          <ActionButton
            icon={<InboxOutlined />}
            tooltip={t('ARCHIVE')}
            onClick={handleArchive}
            loading={loadingStates.archive}
            isDarkMode={isDarkMode}
          />

          {/* Delete */}
          <Popconfirm
            title={t('DELETE_TASKS_CONFIRM', { count: totalSelected })}
            description={t('DELETE_TASKS_WARNING')}
            onConfirm={handleDelete}
            okText={t('DELETE')}
            cancelText={t('CANCEL')}
            okType="danger"
            placement="top"
          >
            <ActionButton
              icon={<DeleteOutlined />}
              tooltip={t('DELETE')}
              loading={loadingStates.delete}
              danger
              isDarkMode={isDarkMode}
            />
          </Popconfirm>

          {/* More Options (Create Task Template) - Only for owners/admins */}
          {isOwnerOrAdmin && (
            <Tooltip title={t('moreOptions')} placement="top">
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: '1',
                      label: t('createTaskTemplate'),
                      onClick: handleOpenTemplateDrawer,
                    },
                  ],
                }}
                placement="top"
                arrow
              >
                <Button
                  icon={<MoreOutlined />}
                  style={{
                    background: 'transparent',
                    color: isDarkMode ? '#e5e7eb' : '#374151',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '6px',
                    height: '32px',
                    width: '32px',
                    fontSize: '14px',
                    borderRadius: '6px',
                    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                  size="small"
                  type="text"
                />
              </Dropdown>
            </Tooltip>
          )}

          <Divider
            type="vertical"
            style={{
              height: '20px',
              margin: '0 4px',
              borderColor: isDarkMode ? 'rgba(55, 65, 81, 0.5)' : 'rgba(229, 231, 235, 0.8)',
            }}
          />

          {/* Clear Selection */}
          <ActionButton
            icon={<CloseOutlined />}
            tooltip={t('CLEAR_SELECTION')}
            onClick={onClearSelection}
            isDarkMode={isDarkMode}
          />
        </Space>

        {/* Task Template Drawer */}
        {createPortal(
          <TaskTemplateDrawer
            showDrawer={showDrawer}
            selectedTemplateId={null}
            onClose={() => {
              setShowDrawer(false);
              onClearSelection?.();
            }}
          />,
          document.body,
          'create-task-template'
        )}
      </div>
    );
  }
);

OptimizedBulkActionBarContent.displayName = 'OptimizedBulkActionBarContent';

// Portal wrapper for performance isolation
const OptimizedBulkActionBar: React.FC<OptimizedBulkActionBarProps> = React.memo(props => {
  if (!props.totalSelected || Number(props.totalSelected) < 1) {
    return null;
  }

  return createPortal(
    <OptimizedBulkActionBarContent {...props} />,
    document.body,
    'optimized-bulk-action-bar'
  );
});

OptimizedBulkActionBar.displayName = 'OptimizedBulkActionBar';

export default OptimizedBulkActionBar;
