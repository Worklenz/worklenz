import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Button, 
  Typography, 
  Dropdown, 
  Popconfirm, 
  Tooltip, 
  Space,
  Badge,
  Divider,
  type InputRef,
  message
} from '@/shared/antd-imports';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';
import {
  DeleteOutlined,
  CloseOutlined,
  MoreOutlined,
  SyncOutlined,
  UserOutlined,
  BellOutlined,
  TagOutlined,
  UsergroupAddOutlined,
  CheckOutlined,
  EditOutlined,
  FileOutlined,
  ImportOutlined,
  CalendarOutlined,
  BarChartOutlined,
  SettingOutlined
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { RootState } from '@/app/store';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { clearSelection } from '@/features/task-management/selection.slice';
import { fetchTasksV3 } from '@/features/task-management/task-management.slice';
import { taskListBulkActionsApiService } from '@/api/tasks/task-list-bulk-actions.api.service';
import {
  evt_project_task_list_bulk_archive,
  evt_project_task_list_bulk_assign_me,
  evt_project_task_list_bulk_assign_members,
  evt_project_task_list_bulk_change_phase,
  evt_project_task_list_bulk_change_priority,
  evt_project_task_list_bulk_change_status,
  evt_project_task_list_bulk_delete,
  evt_project_task_list_bulk_update_labels,
} from '@/shared/worklenz-analytics-events';
import {
  IBulkTasksLabelsRequest,
  IBulkTasksPhaseChangeRequest,
  IBulkTasksPriorityChangeRequest,
  IBulkTasksStatusChangeRequest,
} from '@/types/tasks/bulk-action-bar.types';
import { ITaskStatus } from '@/types/tasks/taskStatus.types';
import { ITaskPriority } from '@/types/tasks/taskPriority.types';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';
import { ITaskLabel } from '@/types/tasks/taskLabel.types';
import { ITeamMemberViewModel } from '@/types/teamMembers/teamMembersGetResponse.types';
import { ITeamMembersViewModel } from '@/types/teamMembers/teamMembersViewModel.types';
import { ITaskAssignee } from '@/types/tasks/task.types';
import { createPortal as createReactPortal } from 'react-dom';
import TaskTemplateDrawer from '@/components/task-templates/task-template-drawer';
import AssigneesDropdown from '@/components/taskListCommon/task-list-bulk-actions-bar/components/AssigneesDropdown';
import LabelsDropdown from '@/components/taskListCommon/task-list-bulk-actions-bar/components/LabelsDropdown';
import { sortTeamMembers } from '@/utils/sort-team-members';
import { fetchLabels } from '@/features/taskAttributes/taskLabelSlice';
import { useAuthService } from '@/hooks/useAuth';
import { checkTaskDependencyStatus } from '@/utils/check-task-dependency-status';
import alertService from '@/services/alerts/alertService';
import logger from '@/utils/errorLogger';

const { Text } = Typography;

interface OptimizedBulkActionBarProps {
  selectedTaskIds: string[];
  totalSelected: number;
  projectId: string;
  onClearSelection?: () => void;
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
}>(({ icon, tooltip, onClick, loading = false, danger = false, disabled = false, isDarkMode, badge }) => {
  const buttonClasses = useMemo(() => {
    const baseClasses = [
      'flex items-center justify-center',
      'h-8 w-8 p-1.5',
      'text-sm rounded-md',
      'transition-all duration-150 ease-out',
      'border-none bg-transparent',
      'hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2',
      disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
    ];

    if (danger) {
      baseClasses.push(
        isDarkMode 
          ? 'text-red-400 hover:bg-red-400/10 focus:ring-red-400/20' 
          : 'text-red-500 hover:bg-red-500/10 focus:ring-red-500/20'
      );
    } else {
      baseClasses.push(
        isDarkMode 
          ? 'text-gray-300 hover:bg-white/10 focus:ring-gray-400/20' 
          : 'text-gray-600 hover:bg-black/5 focus:ring-gray-400/20'
      );
    }

    return baseClasses.join(' ');
  }, [isDarkMode, danger, disabled]);

  const ButtonComponent = (
    <Button
      icon={icon}
      className={buttonClasses}
      size="small"
      loading={loading}
      disabled={disabled}
      onClick={onClick}
      type="text"
      style={{ background: 'transparent', border: 'none' }}
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
});

ActionButton.displayName = 'ActionButton';

// Performance-optimized main component
const OptimizedBulkActionBarContent: React.FC<OptimizedBulkActionBarProps> = React.memo(({
  selectedTaskIds,
  totalSelected,
  projectId,
  onClearSelection,
}) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('tasks/task-table-bulk-actions');
  const { trackMixpanelEvent } = useMixpanelTracking();
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();
  
  // Performance state management
  const [isVisible, setIsVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [updatingLabels, setUpdatingLabels] = useState(false);
  const [updatingAssignToMe, setUpdatingAssignToMe] = useState(false);
  const [updatingAssignees, setUpdatingAssignees] = useState(false);
  const [updatingArchive, setUpdatingArchive] = useState(false);
  const [updatingDelete, setUpdatingDelete] = useState(false);

  // Selectors
  const statusList = useAppSelector(state => state.taskStatusReducer.status);
  const priorityList = useAppSelector(state => state.priorityReducer.priorities);
  const phaseList = useAppSelector(state => state.phaseReducer.phaseList);
  const labelsList = useAppSelector(state => state.taskLabelsReducer.labels);
  const members = useAppSelector(state => state.teamMembersReducer.teamMembers);
  const archived = useAppSelector(state => state.taskReducer.archived);
  const isDarkMode = useSelector((state: RootState) => state.themeReducer?.mode === 'dark');

  // Local state for dropdowns
  const labelsInputRef = useRef<InputRef>(null);
  const [createLabelText, setCreateLabelText] = useState<string>('');
  const [teamMembersSorted, setTeamMembersSorted] = useState<ITeamMembersViewModel>({
    data: [],
    total: 0,
  });
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<ITaskLabel[]>([]);

  // Smooth entrance animation
  useEffect(() => {
    if (totalSelected > 0) {
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [totalSelected]);

  // Update team members when dropdown opens
  useEffect(() => {
    if (members?.data && assigneeDropdownOpen) {
      let sortedMembers = sortTeamMembers(members.data);
      setTeamMembersSorted({ data: sortedMembers, total: members.total });
    }
  }, [assigneeDropdownOpen, members?.data]);

  // Handlers
  const handleChangeStatus = useCallback(async (status: ITaskStatus) => {
    if (!status.id || !projectId) return;
    try {
      setLoading(true);

      const body: IBulkTasksStatusChangeRequest = {
        tasks: selectedTaskIds,
        status_id: status.id,
      };
      
      // Check task dependencies first
      for (const taskId of selectedTaskIds) {
        const canContinue = await checkTaskDependencyStatus(taskId, status.id);
        if (!canContinue) {
          if (selectedTaskIds.length > 1) {
            alertService.warning(
              'Incomplete Dependencies!',
              'Some tasks were not updated. Please ensure all dependent tasks are completed before proceeding.'
            );
          } else {
            alertService.error(
              'Task is not completed',
              'Please complete the task dependencies before proceeding'
            );
          }
          return;
        }
      }

      const res = await taskListBulkActionsApiService.changeStatus(body, projectId);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_change_status);
        dispatch(clearSelection());
        dispatch(fetchTasksV3(projectId));
        onClearSelection?.();
        message.success(`Status updated for ${selectedTaskIds.length} task${selectedTaskIds.length > 1 ? 's' : ''}`);
      }
    } catch (error) {
      logger.error('Error changing status:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedTaskIds, projectId, trackMixpanelEvent, dispatch, onClearSelection]);

  const handleChangePriority = useCallback(async (priority: ITaskPriority) => {
    if (!priority.id || !projectId) return;
    try {
      setLoading(true);
      const body: IBulkTasksPriorityChangeRequest = {
        tasks: selectedTaskIds,
        priority_id: priority.id,
      };
      const res = await taskListBulkActionsApiService.changePriority(body, projectId);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_change_priority);
        dispatch(clearSelection());
        dispatch(fetchTasksV3(projectId));
        onClearSelection?.();
        message.success(`Priority updated for ${selectedTaskIds.length} task${selectedTaskIds.length > 1 ? 's' : ''}`);
      }
    } catch (error) {
      logger.error('Error changing priority:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedTaskIds, projectId, trackMixpanelEvent, dispatch, onClearSelection]);

  const handleChangePhase = useCallback(async (phase: ITaskPhase) => {
    if (!phase.id || !projectId) return;
    try {
      setLoading(true);
      const body: IBulkTasksPhaseChangeRequest = {
        tasks: selectedTaskIds,
        phase_id: phase.id,
      };
      const res = await taskListBulkActionsApiService.changePhase(body, projectId);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_change_phase);
        dispatch(clearSelection());
        dispatch(fetchTasksV3(projectId));
        onClearSelection?.();
        message.success(`Phase updated for ${selectedTaskIds.length} task${selectedTaskIds.length > 1 ? 's' : ''}`);
      }
    } catch (error) {
      logger.error('Error changing phase:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedTaskIds, projectId, trackMixpanelEvent, dispatch, onClearSelection]);

  const handleAssignToMe = useCallback(async () => {
    if (!projectId) return;
    try {
      setUpdatingAssignToMe(true);
      const body = {
        tasks: selectedTaskIds,
        project_id: projectId,
      };
      const res = await taskListBulkActionsApiService.assignToMe(body);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_assign_me);
        dispatch(clearSelection());
        dispatch(fetchTasksV3(projectId));
        onClearSelection?.();
        message.success(`Assigned ${selectedTaskIds.length} task${selectedTaskIds.length > 1 ? 's' : ''} to you`);
      }
    } catch (error) {
      logger.error('Error assigning to me:', error);
    } finally {
      setUpdatingAssignToMe(false);
    }
  }, [selectedTaskIds, projectId, trackMixpanelEvent, dispatch, onClearSelection]);

  const handleChangeAssignees = useCallback(async (selectedAssignees: ITeamMemberViewModel[]) => {
    if (!projectId) return;
    try {
      setUpdatingAssignees(true);
      const body = {
        tasks: selectedTaskIds,
        project_id: projectId,
        members: selectedAssignees.map(member => ({
          id: member.id || '',
          name: member.name || '',
          email: member.email || '',
          avatar_url: member.avatar_url || '',
          team_member_id: member.id || '',
          project_member_id: member.id || '',
        })) as ITaskAssignee[],
      };
      const res = await taskListBulkActionsApiService.assignTasks(body);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_assign_members);
        dispatch(clearSelection());
        dispatch(fetchTasksV3(projectId));
        onClearSelection?.();
        message.success(`Assigned ${selectedTaskIds.length} task${selectedTaskIds.length > 1 ? 's' : ''} to ${selectedAssignees.length} member${selectedAssignees.length > 1 ? 's' : ''}`);
      }
    } catch (error) {
      logger.error('Error assigning tasks:', error);
    } finally {
      setUpdatingAssignees(false);
    }
  }, [selectedTaskIds, projectId, trackMixpanelEvent, dispatch, onClearSelection]);

  const handleArchive = useCallback(async () => {
    if (!projectId) return;
    try {
      setUpdatingArchive(true);
      const body = {
        tasks: selectedTaskIds,
        project_id: projectId,
      };
      const res = await taskListBulkActionsApiService.archiveTasks(body, archived);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_archive);
        dispatch(clearSelection());
        dispatch(fetchTasksV3(projectId));
        onClearSelection?.();
        message.success(`${archived ? 'Unarchived' : 'Archived'} ${selectedTaskIds.length} task${selectedTaskIds.length > 1 ? 's' : ''}`);
      }
    } catch (error) {
      logger.error('Error archiving tasks:', error);
    } finally {
      setUpdatingArchive(false);
    }
  }, [selectedTaskIds, projectId, archived, trackMixpanelEvent, dispatch, onClearSelection]);

  const handleDelete = useCallback(async () => {
    if (!projectId) return;
    try {
      setUpdatingDelete(true);
      const body = {
        tasks: selectedTaskIds,
        project_id: projectId,
      };
      const res = await taskListBulkActionsApiService.deleteTasks(body, projectId);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_delete);
        dispatch(deselectAll());
        dispatch(fetchTasksV3(projectId));
        onClearSelection?.();
        message.success(`Deleted ${selectedTaskIds.length} task${selectedTaskIds.length > 1 ? 's' : ''}`);
      }
    } catch (error) {
      logger.error('Error deleting tasks:', error);
    } finally {
      setUpdatingDelete(false);
    }
  }, [selectedTaskIds, projectId, trackMixpanelEvent, dispatch, onClearSelection]);

  const handleLabelChange = useCallback((e: CheckboxChangeEvent, label: ITaskLabel) => {
    if (e.target.checked) {
      setSelectedLabels(prev => [...prev, label]);
    } else {
      setSelectedLabels(prev => prev.filter(l => l.id !== label.id));
    }
  }, []);

  const applyLabels = useCallback(async () => {
    if (!projectId) return;
    try {
      setUpdatingLabels(true);
      const body: IBulkTasksLabelsRequest = {
        tasks: selectedTaskIds,
        labels: selectedLabels,
        text:
          selectedLabels.length > 0
            ? null
            : createLabelText.trim() !== ''
              ? createLabelText.trim()
              : null,
      };
      const res = await taskListBulkActionsApiService.assignLabels(body, projectId);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_update_labels);
        dispatch(deselectAll());
        dispatch(fetchTasksV3(projectId));
        dispatch(fetchLabels());
        setCreateLabelText('');
        setSelectedLabels([]);
        onClearSelection?.();
        const labelCount = selectedLabels.length > 0 ? selectedLabels.length : 1;
        const action = selectedLabels.length > 0 ? 'Labels updated' : 'Label created';
        message.success(`${action} for ${selectedTaskIds.length} task${selectedTaskIds.length > 1 ? 's' : ''}`);
      }
    } catch (error) {
      logger.error('Error updating labels:', error);
    } finally {
      setUpdatingLabels(false);
    }
  }, [selectedTaskIds, selectedLabels, createLabelText, projectId, trackMixpanelEvent, dispatch, onClearSelection]);

  // Menu Generators
  const getChangeOptionsMenu = useMemo(() => [
    {
      key: '1',
      label: t('status'),
      children: statusList.map(status => ({
        key: status.id,
        onClick: () => handleChangeStatus(status),
        label: <Badge color={status.color_code} text={status.name} />,
      })),
    },
    {
      key: '2',
      label: t('priority'),
      children: priorityList.map(priority => ({
        key: priority.id,
        onClick: () => handleChangePriority(priority),
        label: <Badge color={priority.color_code} text={priority.name} />,
      })),
    },
    {
      key: '3',
      label: t('phase'),
      children: phaseList.map(phase => ({
        key: phase.id,
        onClick: () => handleChangePhase(phase),
        label: <Badge color={phase.color_code} text={phase.name} />,
      })),
    },
  ], [statusList, priorityList, phaseList, handleChangeStatus, handleChangePriority, handleChangePhase, t]);

  const getAssigneesMenu = useCallback(() => {
    return (
      <AssigneesDropdown
        members={teamMembersSorted?.data || []}
        themeMode={isDarkMode ? 'dark' : 'light'}
        onApply={handleChangeAssignees}
        onClose={() => setAssigneeDropdownOpen(false)}
        t={t}
      />
    );
  }, [teamMembersSorted?.data, isDarkMode, handleChangeAssignees, t]);

  const labelsDropdownContent = useMemo(() => (
    <LabelsDropdown
      labelsList={labelsList}
      themeMode={isDarkMode ? 'dark' : 'light'}
      createLabelText={createLabelText}
      selectedLabels={selectedLabels}
      labelsInputRef={labelsInputRef as React.RefObject<InputRef>}
      onLabelChange={handleLabelChange}
      onCreateLabelTextChange={value => setCreateLabelText(value)}
      onApply={applyLabels}
      t={t}
      loading={updatingLabels}
    />
  ), [labelsList, isDarkMode, createLabelText, selectedLabels, handleLabelChange, applyLabels, t, updatingLabels]);

  const onAssigneeDropdownOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setAssigneeDropdownOpen(false);
    } else {
      setAssigneeDropdownOpen(true);
    }
  }, []);

  // Memoized styles for better performance
  const containerStyle = useMemo((): React.CSSProperties => ({
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: `translateX(-50%) translateY(${isVisible ? '0' : '20px'})`,
    zIndex: 1000,
    background: isDarkMode 
      ? 'rgba(31, 41, 55, 0.95)' 
      : 'rgba(255, 255, 255, 0.95)',
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
  }), [isDarkMode, isVisible]);



  const getLabel = useMemo(() => {
    const word = totalSelected < 2 ? t('taskSelected') : t('tasksSelected');
    return `${totalSelected} ${word}`;
  }, [totalSelected, t]);

  // Don't render if no tasks selected
  if (totalSelected === 0) {
    return null;
  }

  return (
    <>
      <div 
        className={`
          fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50
          flex items-center gap-1 px-5 py-3
          min-w-fit max-w-[90vw]
          rounded-2xl backdrop-blur-xl
          transition-all duration-300 ease-out
          ${isVisible ? 'translate-y-0 opacity-100 visible' : 'translate-y-5 opacity-0 invisible'}
          ${isDarkMode 
            ? 'bg-gray-800/95 border border-gray-600/30 shadow-2xl shadow-black/40' 
            : 'bg-white/95 border border-gray-200/80 shadow-xl shadow-black/10'
          }
        `}
      >
        {/* Selection Count */}
        <div className={`
          flex items-center gap-2 mr-3
          ${isDarkMode ? 'text-gray-100' : 'text-gray-700'}
        `}>
          <Badge 
            count={totalSelected} 
            className={`
              ${isDarkMode ? 'bg-blue-500' : 'bg-blue-600'}
              text-white text-xs font-medium
              h-4.5 min-w-[18px] leading-[18px]
            `}
          />
          <span className="text-sm font-medium whitespace-nowrap">
            {getLabel}
          </span>
        </div>

        <div className={`
          w-px h-5 mx-2
          ${isDarkMode ? 'bg-gray-600/50' : 'bg-gray-300/80'}
        `} />

        {/* Actions */}
        <div className="flex items-center gap-0.5">
          {/* Change Status/Priority/Phase */}
          <Tooltip title={t('changeStatus')} placement="top">
            <Dropdown 
              menu={{ items: getChangeOptionsMenu }} 
              trigger={['click']}
              placement="bottom"
              arrow
            >
              <ActionButton
                icon={<SyncOutlined />}
                tooltip={t('changeStatus')}
                loading={loading}
                isDarkMode={isDarkMode}
              />
            </Dropdown>
          </Tooltip>

          {/* Change Labels */}
          <Tooltip title={t('changeLabel')} placement="top">
            <Dropdown
              dropdownRender={() => labelsDropdownContent}
              placement="top"
              arrow
              trigger={['click']}
              onOpenChange={value => {
                if (!value) {
                  setSelectedLabels([]);
                }
              }}
            >
              <ActionButton
                icon={<TagOutlined />}
                tooltip={t('changeLabel')}
                loading={updatingLabels}
                isDarkMode={isDarkMode}
              />
            </Dropdown>
          </Tooltip>

          {/* Assign to Me */}
          <ActionButton
            icon={<UserOutlined />}
            tooltip={t('assignToMe')}
            onClick={handleAssignToMe}
            loading={updatingAssignToMe}
            isDarkMode={isDarkMode}
          />

          {/* Change Assignees */}
          <Tooltip title={t('changeAssignees')} placement="top">
            <Dropdown
              dropdownRender={getAssigneesMenu}
              open={assigneeDropdownOpen}
              onOpenChange={onAssigneeDropdownOpenChange}
              placement="top"
              arrow
              trigger={['click']}
            >
              <ActionButton
                icon={<UsergroupAddOutlined />}
                tooltip={t('changeAssignees')}
                loading={updatingAssignees}
                isDarkMode={isDarkMode}
              />
            </Dropdown>
          </Tooltip>

          {/* Archive */}
          <ActionButton
            icon={<BellOutlined />}
            tooltip={archived ? t('unarchive') : t('archive')}
            onClick={handleArchive}
            loading={updatingArchive}
            isDarkMode={isDarkMode}
          />

          {/* Delete */}
          <Popconfirm
            title={`${t('delete')} ${totalSelected} ${totalSelected === 1 ? t('task') : t('tasks')}?`}
            description={t('deleteConfirmation')}
            onConfirm={handleDelete}
            okText={t('delete')}
            cancelText={t('cancel')}
            okType="danger"
            placement="top"
          >
            <ActionButton
              icon={<DeleteOutlined />}
              tooltip={t('delete')}
              loading={updatingDelete}
              danger
              isDarkMode={isDarkMode}
            />
          </Popconfirm>

          {isOwnerOrAdmin && (
            <Tooltip title={t('moreOptions')} placement="top">
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: '1',
                      label: t('createTaskTemplate'),
                      onClick: () => setShowDrawer(true),
                    },
                  ],
                }}
              >
                <ActionButton
                  icon={<MoreOutlined />}
                  tooltip={t('moreOptions')}
                  isDarkMode={isDarkMode}
                />
              </Dropdown>
            </Tooltip>
          )}

          <div className={`
            w-px h-5 mx-1
            ${isDarkMode ? 'bg-gray-600/50' : 'bg-gray-300/80'}
          `} />

          {/* Clear Selection */}
          <ActionButton
            icon={<CloseOutlined />}
            tooltip={t('deselectAll')}
            onClick={onClearSelection}
            isDarkMode={isDarkMode}
          />
        </div>
      </div>

      {/* Portals for modals */}
      {createReactPortal(
        <TaskTemplateDrawer
          showDrawer={showDrawer}
          selectedTemplateId={null}
          onClose={() => {
            setShowDrawer(false);
            dispatch(deselectAll());
          }}
        />,
        document.body,
        'create-task-template'
      )}
    </>
  );
});

OptimizedBulkActionBarContent.displayName = 'OptimizedBulkActionBarContent';

// Portal wrapper for performance isolation
const OptimizedBulkActionBar: React.FC<OptimizedBulkActionBarProps> = React.memo((props) => {
  // Only render portal if tasks are selected for better performance
  if (props.totalSelected === 0) {
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