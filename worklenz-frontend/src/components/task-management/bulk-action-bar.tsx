import React, { useEffect, useRef, useState } from 'react';
import { Button, Typography, Dropdown, Menu, Popconfirm, message, Tooltip, Badge, CheckboxChangeEvent, InputRef } from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  TagOutlined,
  UserOutlined,
  CheckOutlined,
  CloseOutlined,
  MoreOutlined,
  RetweetOutlined,
  UserAddOutlined,
  InboxOutlined,
  TagsOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { IGroupBy, fetchTaskGroups } from '@/features/tasks/tasks.slice';
import { AppDispatch, RootState } from '@/app/store';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { deselectAll } from '@/features/projects/bulkActions/bulkActionSlice';
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
import { createPortal } from 'react-dom';
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

interface BulkActionBarProps {
  selectedTaskIds: string[];
  totalSelected: number;
  currentGrouping: IGroupBy;
  projectId: string;
  onClearSelection?: () => void;
}

const BulkActionBarContent: React.FC<BulkActionBarProps> = ({
  selectedTaskIds,
  totalSelected,
  currentGrouping,
  projectId,
  onClearSelection,
}) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('tasks/task-table-bulk-actions');
  const { trackMixpanelEvent } = useMixpanelTracking();
  
  // Add permission hooks
  const isOwnerOrAdmin = useAuthService().isOwnerOrAdmin();

  // loading state
  const [loading, setLoading] = useState(false);
  const [updatingLabels, setUpdatingLabels] = useState(false);
  const [updatingAssignToMe, setUpdatingAssignToMe] = useState(false);
  const [updatingAssignees, setUpdatingAssignees] = useState(false);
  const [updatingArchive, setUpdatingArchive] = useState(false);
  const [updatingDelete, setUpdatingDelete] = useState(false);

  // Selectors
  const { selectedTaskIdsList } = useAppSelector(state => state.bulkActionReducer);
  const statusList = useAppSelector(state => state.taskStatusReducer.status);
  const priorityList = useAppSelector(state => state.priorityReducer.priorities);
  const phaseList = useAppSelector(state => state.phaseReducer.phaseList);
  const labelsList = useAppSelector(state => state.taskLabelsReducer.labels);
  const members = useAppSelector(state => state.teamMembersReducer.teamMembers);
  const archived = useAppSelector(state => state.taskReducer.archived);
  const themeMode = useAppSelector(state => state.themeReducer.mode);

  const labelsInputRef = useRef<InputRef>(null);
  const [createLabelText, setCreateLabelText] = useState<string>('');
  const [teamMembersSorted, setTeamMembersSorted] = useState<ITeamMembersViewModel>({
    data: [],
    total: 0,
  });
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [selectedLabels, setSelectedLabels] = useState<ITaskLabel[]>([]);

  // Handlers
  const handleChangeStatus = async (status: ITaskStatus) => {
    if (!status.id || !projectId) return;
    try {
      setLoading(true);

      const body: IBulkTasksStatusChangeRequest = {
        tasks: selectedTaskIds,
        status_id: status.id,
      };
      const res = await taskListBulkActionsApiService.changeStatus(body, projectId);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_change_status);
        dispatch(deselectAll());
        dispatch(fetchTaskGroups(projectId));
        onClearSelection?.();
      }
      for (const it of selectedTaskIds) {
        const canContinue = await checkTaskDependencyStatus(it, status.id);
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
    } catch (error) {
      logger.error('Error changing status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePriority = async (priority: ITaskPriority) => {
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
        dispatch(deselectAll());
        dispatch(fetchTaskGroups(projectId));
        onClearSelection?.();
      }
    } catch (error) {
      logger.error('Error changing priority:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePhase = async (phase: ITaskPhase) => {
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
        dispatch(deselectAll());
        dispatch(fetchTaskGroups(projectId));
        onClearSelection?.();
      }
    } catch (error) {
      logger.error('Error changing phase:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignToMe = async () => {
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
        dispatch(deselectAll());
        dispatch(fetchTaskGroups(projectId));
        onClearSelection?.();
      }
    } catch (error) {
      logger.error('Error assigning to me:', error);
    } finally {
      setUpdatingAssignToMe(false);
    }
  };

  const handleArchive = async () => {
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
        dispatch(deselectAll());
        dispatch(fetchTaskGroups(projectId));
        onClearSelection?.();
      }
    } catch (error) {
      logger.error('Error archiving tasks:', error);
    } finally {
      setUpdatingArchive(false);
    }
  };

  const handleChangeAssignees = async (selectedAssignees: ITeamMemberViewModel[]) => {
    if (!projectId) return;
    try {
      setUpdatingAssignees(true);
      const body = {
        tasks: selectedTaskIds,
        project_id: projectId,
        members: selectedAssignees.map(member => ({
          id: member.id,
          name: member.name || member.email || 'Unknown', // Fix: Ensure name is always a string
          email: member.email || '',
          avatar_url: member.avatar_url,
          team_member_id: member.id,
          project_member_id: member.id,
        })) as ITaskAssignee[],
      };
      const res = await taskListBulkActionsApiService.assignTasks(body);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_assign_members);
        dispatch(deselectAll());
        dispatch(fetchTaskGroups(projectId));
        onClearSelection?.();
      }
    } catch (error) {
      logger.error('Error assigning tasks:', error);
    } finally {
      setUpdatingAssignees(false);
    }
  };

  const handleDelete = async () => {
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
        dispatch(fetchTaskGroups(projectId));
        onClearSelection?.();
      }
    } catch (error) {
      logger.error('Error deleting tasks:', error);
    } finally {
      setUpdatingDelete(false);
    }
  };

  // Menu Generators
  const getChangeOptionsMenu = () => [
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
  ];

  useEffect(() => {
    if (members?.data && assigneeDropdownOpen) {
      let sortedMembers = sortTeamMembers(members.data);
      setTeamMembersSorted({ data: sortedMembers, total: members.total });
    }
  }, [assigneeDropdownOpen, members?.data]);

  const getAssigneesMenu = () => {
    return (
      <AssigneesDropdown
        members={teamMembersSorted?.data || []}
        themeMode={themeMode}
        onApply={handleChangeAssignees}
        onClose={() => setAssigneeDropdownOpen(false)}
        t={t}
      />
    );
  };

  const handleLabelChange = (e: CheckboxChangeEvent, label: ITaskLabel) => {
    if (e.target.checked) {
      setSelectedLabels(prev => [...prev, label]);
    } else {
      setSelectedLabels(prev => prev.filter(l => l.id !== label.id));
    }
  };

  const applyLabels = async () => {
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
        dispatch(fetchTaskGroups(projectId));
        dispatch(fetchLabels()); // Fallback: refetch all labels
        setCreateLabelText('');
        setSelectedLabels([]);
        onClearSelection?.();
      }
    } catch (error) {
      logger.error('Error updating labels:', error);
    } finally {
      setUpdatingLabels(false);
    }
  };

  const labelsDropdownContent = (
    <LabelsDropdown
      labelsList={labelsList}
      themeMode={themeMode}
      createLabelText={createLabelText}
      selectedLabels={selectedLabels}
      labelsInputRef={labelsInputRef as React.RefObject<InputRef>}
      onLabelChange={handleLabelChange}
      onCreateLabelTextChange={value => setCreateLabelText(value)}
      onApply={applyLabels}
      t={t}
      loading={updatingLabels}
    />
  );

  const onAssigneeDropdownOpenChange = (open: boolean) => {
    setAssigneeDropdownOpen(open);
  };

  const buttonStyle = {
    background: 'transparent',
    color: '#fff',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 8px',
    height: '32px',
    fontSize: '16px',
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        background: '#252628',
        borderRadius: '25px',
        padding: '8px 16px',
        boxShadow: '0 0 0 1px #434343, 0 4px 12px 0 rgba(0, 0, 0, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        minWidth: 'fit-content',
      }}
    >
      <Text style={{ color: '#fff', fontSize: '14px', fontWeight: 500, marginRight: '8px' }}>
        {totalSelected} task{totalSelected > 1 ? 's' : ''} selected
      </Text>

      {/* Status/Priority/Phase Change */}
      <Tooltip title="Change Status/Priority/Phase">
        <Dropdown menu={{ items: getChangeOptionsMenu() }} trigger={['click']}>
          <Button 
            icon={<RetweetOutlined />}
            style={buttonStyle}
            size="small"
            loading={loading}
          />
        </Dropdown>
      </Tooltip>

      {/* Labels */}
      <Tooltip title="Add Labels">
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
          <Button 
            icon={<TagsOutlined />}
            style={buttonStyle}
            size="small"
            loading={updatingLabels}
          />
        </Dropdown>
      </Tooltip>

      {/* Assign to Me */}
      <Tooltip title="Assign to Me">
        <Button 
          icon={<UserAddOutlined />}
          style={buttonStyle}
          size="small"
          onClick={handleAssignToMe}
          loading={updatingAssignToMe}
        />
      </Tooltip>

      {/* Assign Members */}
      <Tooltip title="Assign Members">
        <Dropdown
          dropdownRender={getAssigneesMenu}
          open={assigneeDropdownOpen}
          onOpenChange={onAssigneeDropdownOpenChange}
          placement="top"
          arrow
          trigger={['click']}
        >
          <Button 
            icon={<UsergroupAddOutlined />}
            style={buttonStyle}
            size="small"
            loading={updatingAssignees}
          />
        </Dropdown>
      </Tooltip>

      {/* Archive */}
      <Tooltip title={archived ? 'Unarchive' : 'Archive'}>
        <Button 
          icon={<InboxOutlined />}
          style={buttonStyle}
          size="small"
          onClick={handleArchive}
          loading={updatingArchive}
        />
      </Tooltip>

      {/* Delete */}
      <Tooltip title="Delete">
        <Popconfirm
          title={`Delete ${totalSelected} task${totalSelected > 1 ? 's' : ''}?`}
          description="This action cannot be undone."
          onConfirm={handleDelete}
          okText="Delete"
          cancelText="Cancel"
          okType="danger"
        >
          <Button 
            icon={<DeleteOutlined />}
            style={buttonStyle}
            size="small"
            loading={updatingDelete}
          />
        </Popconfirm>
      </Tooltip>

      {/* More Actions - Only for Owner/Admin */}
      {isOwnerOrAdmin && (
        <Tooltip title="More Actions">
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'createTemplate',
                  label: 'Create task template',
                  onClick: () => setShowDrawer(true),
                },
              ],
            }}
          >
            <Button 
              icon={<MoreOutlined />}
              style={buttonStyle}
              size="small"
            />
          </Dropdown>
        </Tooltip>
      )}

      {/* Clear Selection */}
      <Tooltip title="Clear Selection">
        <Button
          icon={<CloseOutlined />}
          onClick={onClearSelection}
          style={buttonStyle}
          size="small"
        />
      </Tooltip>

      {/* Task Template Drawer */}
      {createPortal(
        <TaskTemplateDrawer
          showDrawer={showDrawer}
          selectedTemplateId={null}
          onClose={() => {
            setShowDrawer(false);
            dispatch(deselectAll());
            onClearSelection?.();
          }}
        />,
        document.body,
        'create-task-template'
      )}
    </div>
  );
};

const BulkActionBar: React.FC<BulkActionBarProps> = (props) => {
  // Render the bulk action bar through a portal to avoid suspense issues
  return createPortal(
    <BulkActionBarContent {...props} />,
    document.body,
    'bulk-action-bar'
  );
};

export default BulkActionBar; 